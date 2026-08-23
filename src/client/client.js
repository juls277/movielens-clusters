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


  
}


//start client

main().catch((error) => {

  console.error(
    "Client failed:",
    error
  );

});