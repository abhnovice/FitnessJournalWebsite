"""Rebuild the supplied SVM once; export numeric browser inference assets.

Requires the upstream model.npz, verified MobileNet encoder and workbook.
No training runs in the browser. No pickle is loaded or emitted.
"""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import numpy as np
import onnx
import onnxruntime as ort
import openpyxl
from PIL import Image
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
import re
import urllib.request

PIN = '7742b5454b9e62bb1c536469e6806c3fc23b0296'
MODEL_SHA = '5fc6b1fa9a4a7eda7a8ff220741ca1d531841b0896e4f4e63731de4975cae089'
ENCODER_SHA = 'c0c3f76d93fa3fd6580652a45618618a220fced18babf65774ed169de0432ad5'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def convert(args):
    root, output = Path(args.assets), Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    model_raw = (root/'model.npz').read_bytes()
    assert digest(model_raw) == MODEL_SHA, 'Unexpected model artifact'
    assert digest((root/'mobilenetv2-12.onnx').read_bytes()) == ENCODER_SHA
    d = np.load(root/'model.npz', allow_pickle=False)
    assert str(d['kind']) == 'deep_svc' and str(d['feature_kind']) == 'mobilenetv2'
    x, y = d['x'], d['y']
    print('Rebuilding original SVC', x.shape, flush=True)
    svc = SVC(C=float(d['c']), kernel='rbf', class_weight='balanced', decision_function_shape='ovr', random_state=42).fit(x, y)
    scaler = StandardScaler().fit(x)
    arrays = dict(x=x.astype('<f4'), support=svc.support_.astype('<u4'),
                  dual=svc.dual_coef_.astype('<f8'), intercept=svc.intercept_.astype('<f8'),
                  mean=scaler.mean_.astype('<f8'), scale=scaler.scale_.astype('<f8'))
    metadata = dict(classes=svc.classes_.tolist(), counts=svc.n_support_.tolist(), gamma=float(svc._gamma),
                    risk=d['risk_coefficients'].tolist(), riskIntercept=float(d['risk_intercept']),
                    distanceLimit=float(d['distance_limit']), features=x.shape[1], rows=x.shape[0], arrays={})
    raw = bytearray()
    for name, a in arrays.items():
        raw.extend(b'\0' * ((-len(raw)) % 8))
        metadata['arrays'][name] = dict(offset=len(raw), length=a.size, dtype=a.dtype.str)
        raw.extend(a.tobytes())
    parts = []
    for i, offset in enumerate(range(0, len(raw), 4*1024*1024)):
        name = f'weights-{i:02d}.bin'
        chunk = bytes(raw[offset:offset+4*1024*1024])
        (output/name).write_bytes(chunk)
        parts.append(dict(name=name, offset=offset, size=len(chunk), sha256=digest(chunk)))
    metadata.update(bytes=len(raw), parts=parts)
    (output/'svm.json').write_text(json.dumps(metadata, separators=(',', ':')))
    # Preserve the exact frozen encoder, but expose its penultimate pooled tensor.
    encoder = onnx.load(root/'mobilenetv2-12.onnx')
    pooled = next(n.output[0] for n in reversed(encoder.graph.node) if n.op_type == 'GlobalAveragePool')
    del encoder.graph.output[:]
    encoder.graph.output.append(onnx.helper.make_tensor_value_info(pooled, onnx.TensorProto.FLOAT, [None,1280,1,1]))
    onnx.save(encoder, output/'encoder.onnx')
    workbook = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
    rows = iter(workbook.active.values)
    headers = next(rows)
    foods = [dict(zip(headers, r)) for r in rows if r[1]]
    workbook.close()
    names = [' '.join(re.findall(r'[a-z0-9]+', str(f['food_name']).lower())) for f in foods]
    tfidf = TfidfVectorizer(analyzer='char_wb', ngram_range=(2,4))
    matrix = tfidf.fit_transform(names)
    catalog = dict(vocabulary=tfidf.vocabulary_, idf=tfidf.idf_.tolist(), foods=[])
    for i, f in enumerate(foods):
        row = matrix.getrow(i)
        n = {k:f.get(col) for k,col in dict(energy_kcal='energy_kcal', protein_g='protein_g', carbohydrate_g='carb_g', fat_g='fat_g').items()}
        n = {k:float(v) if isinstance(v,(int,float)) and np.isfinite(v) else None for k,v in n.items()}
        catalog['foods'].append(dict(name=f['food_name'], normalized=names[i], nutrition=n, indices=row.indices.tolist(), values=row.data.tolist()))
    (Path(args.source)/'src/food-catalog.json').write_text(json.dumps(catalog, separators=(',', ':')))
    # Test vectors compare browser arithmetic with the exact original sklearn path.
    rng = np.random.default_rng(42)
    vectors = np.vstack([x[rng.choice(len(x), 12, replace=False)], x.mean(axis=0), rng.normal(size=(2,x.shape[1])).astype('f4')])
    scores = svc.decision_function(vectors)
    probabilities = np.exp(scores-scores.max(axis=1,keepdims=True)); probabilities /= probabilities.sum(axis=1,keepdims=True)
    ordered = np.sort(probabilities,axis=1)
    entropy = -(probabilities*np.log(np.maximum(probabilities,1e-12))).sum(axis=1)/np.log(len(svc.classes_))
    risk = np.column_stack([ordered[:,-1],ordered[:,-1]-ordered[:,-2],entropy])
    confidence = 1/(1+np.exp(-np.clip(risk@d['risk_coefficients']+d['risk_intercept'],-40,40)))
    fixtures = []
    scaled = scaler.transform(x)
    for i,v in enumerate(vectors):
        q = scaler.transform(v[None])[0]
        distance = np.sqrt(((scaled-q)**2).sum(axis=1)).min()/np.sqrt(x.shape[1])
        fixtures.append(dict(vector=v.tolist(), top=int(probabilities[i].argmax()), confidence=float(confidence[i]), distance=float(distance)))
    fixture_path = Path(args.source)/'tests/fixtures/browser-model-reference.json'
    fixture_path.write_text(json.dumps(fixtures, separators=(',', ':')))
    # Pixel fixture exercises the Pillow-compatible separable bilinear resize.
    pixels = rng.integers(0,256,(17,31,3),dtype=np.uint8)
    resized = np.asarray(Image.fromarray(pixels).resize((224,224),Image.Resampling.BILINEAR))
    (Path(args.source)/'tests/fixtures/browser-resize-reference.json').write_text(json.dumps(dict(width=31,height=17,pixels=pixels.reshape(-1).tolist(),expected=resized.reshape(-1).tolist()),separators=(',',':')))
    arr=np.asarray(resized,dtype=np.float32)/255
    arr=(arr-np.array([.485,.456,.406],dtype='f4'))/np.array([.229,.224,.225],dtype='f4')
    tensor=np.ascontiguousarray(arr.transpose(2,0,1)[None])
    session=ort.InferenceSession(str(output/'encoder.onnx'),providers=['CPUExecutionProvider'])
    feature=session.run(None,{session.get_inputs()[0].name:tensor})[0].ravel()
    feature=(feature/max(float(np.linalg.norm(feature)),1e-12)).astype('f4')
    (Path(args.source)/'tests/fixtures/browser-encoder-reference.json').write_text(json.dumps(feature.tolist(),separators=(',',':')))
    with tarfile.open(args.runtime) as archive:
        for name in ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']:
            (output/name).write_bytes(archive.extractfile('package/dist/'+name).read())
    with urllib.request.urlopen('https://raw.githubusercontent.com/microsoft/onnxruntime/v1.23.2/LICENSE', timeout=30) as response:
        (output/'ORT-LICENSE.txt').write_bytes(response.read())
    assets = {}
    types = {'.mjs':'text/javascript', '.json':'application/json', '.wasm':'application/wasm', '.txt':'text/plain'}
    for p in sorted(output.iterdir()):
        if p.name == 'manifest.json': continue
        data = p.read_bytes()
        assets[p.name] = dict(size=len(data), sha256=digest(data), type=types.get(p.suffix,'application/octet-stream'))
    manifest = dict(version='nutrition-ml-v1', revision=PIN, runtime='onnxruntime-web@1.23.2', assets=assets)
    (output/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
    (Path(args.source)/'src/ml-manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
    print('Exported',len(assets),'assets,',sum(a['size'] for a in assets.values()),'bytes',flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    for name in ['assets','workbook','output','source','runtime']:
        parser.add_argument('--'+name,required=True)
    convert(parser.parse_args())
