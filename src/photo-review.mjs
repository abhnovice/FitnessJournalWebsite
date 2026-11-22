// Shared by the photo review and its regression tests.
export function vegetableLookalike(description) {
  return /\b(sabzi|sabji|subzi|subji|tarkari|poriyal|thoran|aloo|alu|potato(?:es)?|plantain|green banana|raw banana|raw papaya|green papaya|papita|kela|vazhakkai)\b/i.test(description);
}
export function replacePhotoDish(profile, index, corrected) {
  const parts = profile.parts.map((part, i) => i === index ? {...part, per100:corrected.per100} : part);
  const dishes = profile.dishes.map((dish, i) => i === index ? corrected.dish : dish);
  const nutrition = Object.fromEntries(Object.keys(profile.nutrition).map(key => [
    key, parts.reduce((sum, part) => sum + part.grams * part.per100[key], 0) / profile.quantity
  ]));
  return {...profile, parts, dishes, nutrition, name:dishes.map(d => d.name).join(', ').slice(0,200)};
}
