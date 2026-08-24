//http helpers

async function getCluster(type, clusterName) {

  
  // work correctly inside the URL
  const encodedName = encodeURIComponent(clusterName);

  const url =
    `http://localhost:3000/cluster/${type}/${encodedName}`;

  console.log("Requesting cluster:");
  console.log(clusterName);

  console.log("URL:");
  console.log(url);

  // Send HTTP request
  const response = await fetch(url);

  // Check whether server returned an error
  if (!response.ok) {
    throw new Error(
      `Server returned ${response.status}: ${response.statusText}`
    );
  }

  // Convert received JSON into JavaScript objects
  const movies = await response.json();

  return movies;
}

async function fetchClusters(clusterNames){
  const requests = clusterNames.map((cluster) => {

    const type = cluster.includes("+")
      ? "pair"
      : "single";

    return getCluster(type, cluster);
  });
const results = await Promise.all(requests);

return results;
}

//CLUSTER-SELECTION HELPERS

function createGenrePairs(genres){
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

function getUniqueClustersFromSeeds(seeds){
  const seedClusters = [];
  for (const seed of seeds){
  const clusters = getClusterForSeed(seed);
  seedClusters.push(...clusters);
}

const uniqueSeedClusters = [...new Set(seedClusters)];
return uniqueSeedClusters;

}

//USER-HISTORY HELPERS

function createFakeUserHistory(movies){
  const history = [];
  for (const movie of movies){
  history.push({
  id: movie.id,
  title: movie.title,
  genres: movie.genres,
  timeSpent: 10
  });
  }

  return history;
}

function getTopSeeds(userHistory){
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

function removeDuplicates(movies){
  const candidateItems = movies.flat();
  const uniqueItemsMap = new Map();

  for (const movie of candidateItems){
    uniqueItemsMap.set(movie.id, movie)
  }
 const uniqueCandidatesArr = [...uniqueItemsMap.values()];

 return uniqueCandidatesArr;
}

//filtering 

function removeWatchedMovies(candidates, userHistory){
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

function rankCandidates(candidates, seeds){
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

function getTopNRecommendations(rankedCandidates, limit){
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

//DEBUGGING
function printClusterSizes(clusterNames, clusterResults) {

  for (let i = 0; i < clusterNames.length; i++) {

    console.log(
      clusterNames[i],
      "->",
      clusterResults[i].length,
      "movies"
    );
  }
}

//UI helpers 

function displayMovies(movies){
  const container = document.getElementById("moviesContainer");
  container.innerHTML="";
  const moviesToDisplay = movies.slice(0, 50);
  for (const movie of moviesToDisplay) {
    const movieButton = document.createElement("button");
    movieButton.textContent = movie.title;

    movieButton.addEventListener("click", () => {showMovieDetails(movie);});
    container.appendChild(movieButton);
}
}

function showMovieDetails(movie) {
  const details = document.getElementById("movieDetails");

  details.innerHTML = `
  <h3>${movie.title}</h3>
  <p>${movie.genres.join(", ")}</p>
  <p>${movie.overview}</p>
`;

}

//MAIN
async function main(selectedGenres) {

  

  
  console.log("Selected genres", selectedGenres);
  const selectedPairs = createGenrePairs(selectedGenres);
  console.log(selectedPairs);

  const clusterResults = await fetchClusters(selectedPairs);

 printClusterSizes(
  selectedPairs,
  clusterResults
);
 
  const uniqueCandidateMovies = removeDuplicates(clusterResults);


  displayMovies(uniqueCandidateMovies);

  console.log("candidates after dedup: ", uniqueCandidateMovies.length);
  console.log("first 5", uniqueCandidateMovies.slice(0,5));

  //temporarily stop for nor
  return;

  //hard coded user history for now 

  
  const userHistory = createFakeUserHistory(uniqueCandidateMovies);

 // console.log("history", userHistory);
  const seeds = getTopSeeds(userHistory);
  console.log("topseeds", seeds);

 for (const seed of seeds){
  console.log(seed.title, "->", seed.genres);
 }

 const uniqueSeedClusters = getUniqueClustersFromSeeds(seeds);


const seedClusterResults =
  await fetchClusters(uniqueSeedClusters);

printClusterSizes(
  uniqueSeedClusters,
  seedClusterResults
);


const uniqueSeedCandidates = removeDuplicates(seedClusterResults);

console.log(
  "Seed candidate movies after deduplication:",
  uniqueSeedCandidates.length
);

const unwatchedCandidates = removeWatchedMovies(uniqueSeedCandidates, userHistory);

const rankedCandidates =
  rankCandidates(
    unwatchedCandidates,
    seeds
  );

 
const recommendations =
  getTopNRecommendations(
    rankedCandidates,
    10
  );

console.log(
  "Top recommendations:",
  recommendations
);

  
}

const loadMoviesButton = document.getElementById('loadMoviesButton');


loadMoviesButton.addEventListener("click", ()=> {
  console.log("Load movies clicked");

  const checkedGenres = document.querySelectorAll('input[type="checkbox"]:checked');

  const selectedGenres = [...checkedGenres].map((checkbox) => {
      return checkbox.value;
    });

   console.log(
    "Selected genres:",
    selectedGenres
  );

   main(selectedGenres).catch((error) => {
    console.error(
      "Client failed:",
      error
    );
  });

  
});



//start client

