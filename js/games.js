// Games players can pick, with rank ladders for the competitive ones.
const LOL = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];

export const GAMES = [
  { name: 'Valorant', ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'] },
  { name: 'League of Legends', ranks: LOL },
  { name: 'Counter-Strike 2', ranks: ['Under 5k', '5k–10k', '10k–15k', '15k–20k', '20k–25k', '25k+'] },
  { name: 'Overwatch 2', ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Champion', 'Top 500'] },
  { name: 'Apex Legends', ranks: ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Apex Predator'] },
  { name: 'Rocket League', ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion', 'Grand Champion', 'Supersonic Legend'] },
  { name: 'Dota 2', ranks: ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'] },
  { name: 'Marvel Rivals', ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Grandmaster', 'Celestial', 'Eternity', 'One Above All'] },
  { name: 'Rainbow Six Siege', ranks: ['Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Champion'] },
  { name: 'Fortnite', ranks: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite', 'Champion', 'Unreal'] },
  { name: 'Call of Duty' },
  { name: 'Minecraft' },
  { name: 'Roblox' },
  { name: 'Genshin Impact' },
  { name: 'Final Fantasy XIV' },
  { name: 'World of Warcraft' },
  { name: 'Destiny 2' },
  { name: 'Elden Ring' },
  { name: "Baldur's Gate 3" },
  { name: 'Helldivers 2' },
  { name: 'Lethal Company' },
  { name: 'Stardew Valley' },
  { name: 'Animal Crossing' },
  { name: 'Mario Kart' },
  { name: 'Super Smash Bros. Ultimate' },
  { name: 'Pokémon' },
  { name: 'EA Sports FC' },
  { name: 'GTA Online' },
  { name: 'Among Us' },
];

export const MAX_GAMES = 10;

export const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile'];
export const REGIONS = ['NA East', 'NA West', 'South America', 'Europe', 'Middle East', 'Africa', 'Asia', 'Oceania'];
export const PLAY_TIMES = ['Mornings', 'Afternoons', 'Evenings', 'Late nights', 'Weekends'];
export const GENDERS = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'nonbinary', label: 'Nonbinary' },
];
export const LOOKING_FOR = [
  { value: 'date', label: 'A date' },
  { value: 'duo', label: 'A duo partner' },
  { value: 'both', label: 'Either' },
];

export function rankIndex(game, rank) {
  const g = GAMES.find((x) => x.name === game);
  return g?.ranks ? g.ranks.indexOf(rank) : -1;
}
