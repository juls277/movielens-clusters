//request cluster from server

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

//main client logic
async function main() {

  

  //hardcoded for now: 
  const selectedGenres = ["Drama", "Romance", "Thriller"];
  console.log("Selected genres", selectedGenres);
  const selectedPairs = createGenrePairs(selectedGenres);
  console.log(selectedPairs);

  const requests = selectedPairs.map((pair)=>{
    return getCluster("pair", pair);
  })

  console.log(requests.length);

  const clusterResults = await Promise.all(requests);

  console.log(clusterResults.length);

  for (let i = 0; i<selectedPairs.length; i++){
    console.log(selectedPairs[i], "->", clusterResults[i].length);
  }

  const candidateMovies = clusterResults.flat();
  console.log("Candidate movies before deduplication:", candidateMovies.length);

  //remove dupes
  const uniqueMoviesMap = new Map();

  for (const movie of candidateMovies){
    uniqueMoviesMap.set(movie.id, movie);

  }

  //covert back to normal arr
  const uniqueCandidateMovies = [
    ...uniqueMoviesMap.values()
  ];

  console.log("candidates after dedup: ", uniqueCandidateMovies.length);
  console.log("first 5", uniqueCandidateMovies.slice(0,5));

  //hard coded user history for now 

  const userHistory = [];
  const viewedMovie1 = uniqueCandidateMovies[2];
  const viewedMovie2 = uniqueCandidateMovies[10];
  const viewedMovie3 = uniqueCandidateMovies[25];

  userHistory.push({
  id: viewedMovie1.id,
  title: viewedMovie1.title,
  genres: viewedMovie1.genres,
  timeSpent: 80
});

userHistory.push({
  id: viewedMovie2.id,
  title: viewedMovie2.title,
  genres: viewedMovie2.genres,
  timeSpent: 40
});

userHistory.push({
  id: viewedMovie3.id,
  title: viewedMovie3.title,
  genres: viewedMovie3.genres,
  timeSpent: 120
});
  console.log("history", userHistory);



  
}


//start client

main().catch((error) => {

  console.error(
    "Client failed:",
    error
  );

});