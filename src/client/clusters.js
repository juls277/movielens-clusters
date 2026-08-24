export function createGenrePairs(genres){
  const pairs = [];

  for (let i=0; i< genres.length; i++){
    for (let j=i+1; j<genres.length; j++){
      const pair = [genres[i], genres[j]].sort().join("+");
      pairs.push(pair);

    }
  }
  return pairs;
}

function getClusterForSeed(seed){
  if (seed.genres.length ===1 ){
    return [seed.genres[0]];
  }

  return createGenrePairs(seed.genres);
}

export function getUniqueClustersFromSeeds(seeds){
  const seedClusters = [];
  for (const seed of seeds){
  const clusters = getClusterForSeed(seed);
  seedClusters.push(...clusters);
}

const uniqueSeedClusters = [...new Set(seedClusters)];
return uniqueSeedClusters;

}
