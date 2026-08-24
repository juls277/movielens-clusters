import { fetchClusters } from "./api.js";
import { getCluster } from "./api.js";
import { createGenrePairs } from "./clusters.js";
import { getUniqueClustersFromSeeds } from "./clusters.js";
import { saveCurrentMovieView, loadUserHistory, startMovieView } from "./history.js";







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



//USER HISTORY HELPERS 


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

 saveCurrentMovieView();

  currentMovie = movie; 
  movieOpenedAt = Date.now();

  const details = document.getElementById("movieDetails");

  details.innerHTML = `
  <h3>${movie.title}</h3>
  <p>${movie.genres.join(", ")}</p>
  <p>${movie.overview}</p>
`;

//remove later 

console.log(
  "Stored history:",
  loadUserHistory()
);



}

function displayRecommendations(recommendations) {
  const container =
    document.getElementById("recommendationsContainer");

  container.innerHTML = "";

  for (const recommendation of recommendations) {
    const item =
      document.createElement("div");

    item.innerHTML = `
      <h3>${recommendation.title}</h3>
      <p>${recommendation.genres.join(", ")}</p>
      <p>Score: ${recommendation.score.toFixed(3)}</p>
    `;

    container.appendChild(item);
  }
}



// RS HELPER
async function generateRecommendationsFromHistory(){
  const userHistory = loadUserHistory();

   if (userHistory.length === 0) {
    console.log("No user history yet");
    return;
  }

  //seed items
  const seeds = getTopSeeds(userHistory);

  console.log("Seeds from real history", seeds);

  //get new clusters based on seed movies 

  const uniqueSeedClusters =
  getUniqueClustersFromSeeds(seeds);

  //fetch these clusters 

  const seedClusterResults =
  await fetchClusters(uniqueSeedClusters);

  //dedup clusters

  const uniqueSeedCandidates =
  removeDuplicates(seedClusterResults);

  //remove what user has seen already 

  const unwatchedCandidates =
  removeWatchedMovies(
    uniqueSeedCandidates,
    userHistory
  );

  const rankedCandidates =
  rankCandidates(
    unwatchedCandidates,
    seeds
  );

  //get recom-s
  const recommendations =
  getTopNRecommendations(
    rankedCandidates,
    10
  );

 displayRecommendations(recommendations);


}

//MAIN
async function main(selectedGenres) {
 console.log(
    "Selected genres",
    selectedGenres
  );

  const selectedPairs =
    createGenrePairs(selectedGenres);

  const clusterResults =
    await fetchClusters(selectedPairs);

  printClusterSizes(
    selectedPairs,
    clusterResults
  );

  const uniqueCandidateMovies =
    removeDuplicates(clusterResults);

  console.log(
    "candidates after dedup:",
    uniqueCandidateMovies.length
  );

  displayMovies(
    uniqueCandidateMovies
  );
  

 
  
}

//BUTTONS 
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

const recommendButton = document.getElementById('recommendButton');
recommendButton.addEventListener('click', ()=>{
  generateRecommendationsFromHistory()
    .catch((error) => {
      console.error(
        "Recommendation failed:",
        error
      );
    });
});

//ON CLOSE/REFRESH 

window.addEventListener("pagehide", () => {
  saveCurrentMovieView();
});

