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
import {
  displayMovies,
  showMovieDetails,
  displayRecommendations
} from "./ui.js";








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

