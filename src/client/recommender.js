export function getTopSeeds(userHistory){
  const last20 = userHistory.slice(-20);

  const filtered = last20.filter((item)=>{
    return item.timeSpent > 5 && item.timeSpent < 600;
  })

  filtered.sort((a,b)=>{
    return b.timeSpent - a.timeSpent;
  })

  const topSeeds = filtered.slice(0,10);

  return topSeeds;
}




//REMOVE DUPLICATES 

export function removeDuplicates(movies){
  const candidateItems = movies.flat();
  const uniqueItemsMap = new Map();

  for (const movie of candidateItems){
    uniqueItemsMap.set(movie.id, movie)
  }
 const uniqueCandidatesArr = [...uniqueItemsMap.values()];

 return uniqueCandidatesArr;
}

//filtering 

export function removeWatchedMovies(candidates, userHistory){
  const watchedIds = new Set (
    userHistory.map((item)=>item.id)
);
  const unwatchedCandidates = candidates.filter((movie)=> { return !watchedIds.has(movie.id);})
  return unwatchedCandidates;
   
  
}

//similarity 

function genreSimilarity(genresA, genresB){
  const setA = new Set(genresA);
  const setB = new Set(genresB);

  const intersection = [...setA].filter((genre)=>setB.has(genre));

 const union = new Set ([...setA, ...setB]);

 const similarity = intersection.length / union.size;

 return similarity; 


}

function scoreCandidate(candidate, seeds) {

   if (seeds.length === 0) {
    return 0;
  }


  let weightedSimilaritySum = 0;
  let totalWeight = 0;

  for (const seed of seeds) {

    const similarity = genreSimilarity(
      candidate.genres,
      seed.genres
    );

    const weight = Math.log(
      1 + seed.timeSpent
    );

    weightedSimilaritySum +=
      weight * similarity;

    totalWeight += weight;
  }

  const score =
    weightedSimilaritySum / totalWeight;

  return score;
}

export function rankCandidates(candidates, seeds){
  const scoredCandidates = candidates.map((movie)=>{
    return {
      movie: movie,
      score: scoreCandidate(movie, seeds)
    };
  })

   scoredCandidates.sort((a, b) => {
    return b.score - a.score;
  });

  return scoredCandidates;
}

export function getTopNRecommendations(rankedCandidates, limit){
  const top = rankedCandidates.slice(0,limit);

  const recommendations = top.map((item)=> {
    return {
      id: item.movie.id,
      title: item.movie.title,
      genres: item.movie.genres,
      score: item.score
    }
  });
  return recommendations;
}
