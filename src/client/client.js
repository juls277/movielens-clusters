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
  displayRecommendations, displayGenreOptions
} from "./ui.js";
import {
  AVAILABLE_GENRES
} from "./clusters.js";


// render genres immediately when page loads
displayGenreOptions(AVAILABLE_GENRES);

function handleMovieClick(movie) {
  startMovieView(movie);
  showMovieDetails(movie);
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

  const selectedClusters = selectedGenres.length === 1
    ? selectedGenres
    : createGenrePairs(selectedGenres);

  const clusterResults =
    await fetchClusters(selectedClusters);

  printClusterSizes(
    selectedClusters,
    clusterResults
  );

  const uniqueCandidateMovies =
    removeDuplicates(clusterResults);

  console.log(
    "candidates after dedup:",
    uniqueCandidateMovies.length
  );

  displayMovies(
  uniqueCandidateMovies,
  handleMovieClick
);
  

 
  
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

//BUTTONS 
const loadMoviesButton = document.getElementById('loadMoviesButton');


loadMoviesButton.addEventListener("click", async () => {
  const startedAt = performance.now();

  console.log("Load movies clicked");

  const checkedGenres = document.querySelectorAll('input[type="checkbox"]:checked');

  const selectedGenres = [...checkedGenres].map((checkbox) => {
      return checkbox.value;
    });

   console.log(
    "Selected genres:",
    selectedGenres
  );

  try {
    await main(selectedGenres);

    // DOM changes are synchronous, but the user does not see them until paint.
    await waitForPaint();

    const responseTime = performance.now() - startedAt;
    console.log(
      `Click-to-display response time: ${responseTime.toFixed(1)} ms`
    );
  } catch (error) {
    console.error(
      "Client failed:",
      error
    );
  }

  
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
