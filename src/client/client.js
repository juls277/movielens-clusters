import { fetchClusters } from "./api.js";
import { getCluster } from "./api.js";
import { createGenrePairs } from "./clusters.js";
import { getUniqueClustersFromSeeds } from "./clusters.js";
import { saveCurrentMovieView, loadUserHistory, startMovieView } from "./history.js";
import {
  getTopSeeds,
  removeDuplicates,
  removeWatchedMovies,
  rankCandidates,
  getTopNRecommendations
} from "./recommender.js";








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

  startMovieView(movie);

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

