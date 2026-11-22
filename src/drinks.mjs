// Rounded generic profiles. Beer, wine and straight-spirit energy values use
// https://medlineplus.gov/ency/patientinstructions/000886.htm as a serving reference.
// Mixed drinks below are estimates for the stated recipes and finished volumes.
function drink(name, aliases, ml, kcal, carbs, note, protein = 0, fat = 0) {
  return {name, aliases, ml, kcal, carbs, protein, fat, note};
}
const spirit = (name, aliases) => drink(name, aliases, 30, 65, 0, 'Plain 40% ABV spirit, served without a mixer.');
export const drinkGroups = {
  'Beer and wine': [
    drink('Regular beer', ['beer', 'lager', 'lager beer'], 330, 142, 11.7, 'Typical regular-strength lager.', 1.5),
    drink('Light beer', ['light lager'], 330, 96, 5.4, 'Typical light beer.', 0.8),
    drink('Red wine', ['red table wine'], 150, 125, 3.8, 'Dry red table wine.', 0.1),
    drink('White wine', ['white table wine'], 150, 121, 3.8, 'Dry white table wine.', 0.1)
  ],
  'Spirits': [
    spirit('Whisky', ['whiskey', 'scotch', 'bourbon']), spirit('Vodka', []),
    spirit('Gin', []), spirit('Rum', ['white rum', 'dark rum']),
    spirit('Tequila', []), spirit('Brandy', ['cognac'])
  ],
  'Cocktails and mixed drinks': [
    drink('Gin and tonic', ['gin tonic', 'g and t'], 200, 154, 14, '45 ml gin with 155 ml regular tonic.'),
    drink('Vodka soda', ['vodka and soda'], 200, 97, 0, '45 ml vodka with 155 ml plain soda water.'),
    drink('Rum and cola', ['rum and coke', 'rum coke'], 200, 162, 16.4, '45 ml rum with 155 ml regular cola.'),
    drink('Whisky and soda', ['whiskey soda', 'whisky soda', 'whiskey and soda'], 200, 97, 0, '45 ml whisky with 155 ml plain soda water.'),
    drink('Mojito', [], 180, 145, 12, '45 ml rum, lime, mint, sugar and soda water.'),
    drink('Margarita', [], 120, 168, 11, 'Tequila, orange liqueur and lime, served over ice.')
  ],
  'Alcohol-free drinks': [
    drink('Sparkling water', ['soda water', 'club soda'], 250, 0, 0, 'Plain carbonated water.'),
    drink('Regular cola', ['cola'], 250, 105, 26.5, 'Sugar-sweetened cola.'),
    drink('Black coffee', ['unsweetened black coffee'], 200, 2, 0, 'Brewed coffee without milk or sugar.', 0.2),
    drink('Black tea', ['unsweetened black tea'], 200, 2, 0.6, 'Brewed tea without milk or sugar.')
  ]
};
