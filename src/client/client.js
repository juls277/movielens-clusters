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

function getClusterForSeed(seed){
  if (seed.genres.length ===1 ){
    return [seed.genres[0]];
  }

  return createGenrePairs(seed.genres);
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
  
  for (let i =0; i< uniqueCandidateMovies.length; i++){
    userHistory.push({
      id: uniqueCandidateMovies[i].id,
      title:uniqueCandidateMovies[i].title,
      genres:uniqueCandidateMovies[i].genres,
      timeSpent: Math.floor(Math.random() * 596) + 5

    })
  };

 // console.log("history", userHistory);
 const seeds = getTopSeeds(userHistory);
 console.log("topseeds", seeds);

 for (seed of seeds){
  console.log(seed.title, "->", seed.genres);
 }
const seedClusters = [];
for (seed of seeds){
  const clusters = getClusterForSeed(seed);
  seedClusters.push(...clusters);
}

const uniqueSeedClusters = [...new Set(seedClusters)];
console.log(uniqueSeedClusters);

const seedRequests = uniqueSeedClusters.map((cluster) => {
  const type = cluster.includes("+") ? "pair" : "single";

  return getCluster(type, cluster);
});

const seedClusterResults =
  await Promise.all(seedRequests);


  console.log(
  "Seed clusters received:",
  seedClusterResults.length
);

for (let i = 0; i < uniqueSeedClusters.length; i++) {
  console.log(
    uniqueSeedClusters[i],
    "->",
    seedClusterResults[i].length,
    "movies"
  );
}

const seedCandidateMovies = seedClusterResults.flat();
console.log(
  "Seed candidate movies before deduplication:",
  seedCandidateMovies.length
);

//remove dupes 
const seedCandidateMap = new Map();
for (movie of seedCandidateMovies) {
  seedCandidateMap.set(movie.id, movie);
}

//back to array 
const uniqueSeedCandidates = [...seedCandidateMap.values()];

console.log(
  "Seed candidate movies after deduplication:",
  uniqueSeedCandidates.length
);

  
}



//start client

main().catch((error) => {

  console.error(
    "Client failed:",
    error
  );

});