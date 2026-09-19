const fs = require("fs");

const text = fs.readFileSync( "data/processed/single/Action.json",
  "utf8");

const movies = JSON.parse(text);
console.log(movies.length, movies[0]);

const ids = movies.map((movie)=>movie.id);

console.log(ids.length, ids.slice(0,5));

//turn into bytes 
const bytes = Buffer.from(JSON.stringify(ids), "utf8");
console.log(bytes.length,bytes.subarray(0,30).toString());

//comedy for comparison 

const comedyText = fs.readFileSync(
  "data/processed/single/Comedy.json",
  "utf8"
);

const comedyMovies = JSON.parse(comedyText);
const comedyIds = comedyMovies.map((movie) => movie.id);
const comedyBytes = Buffer.from(JSON.stringify(comedyIds), "utf8");

console.log("Action bytes:", bytes.length);
console.log("Comedy bytes:", comedyBytes.length);

//
const recordSize = 4 + Math.max(bytes.length, comedyBytes.length);

const actionRecord = Buffer.alloc(recordSize);
actionRecord.writeUInt32LE(bytes.length, 0);
bytes.copy(actionRecord, 4);

console.log("Record size:", actionRecord.length);
//check if record is read back correctly 
const savedLength = actionRecord.readUInt32LE(0);
const savedText = actionRecord
  .subarray(4, 4 + savedLength)
  .toString("utf8");

const savedIds = JSON.parse(savedText);
console.log(savedIds.length, savedIds.slice(0, 5));

//create comedy record 
const comedyRecord = Buffer.alloc(recordSize);
comedyRecord.writeUInt32LE(comedyBytes.length, 0);
comedyBytes.copy(comedyRecord, 4);

const records = [actionRecord, comedyRecord];

//2 records of the same size 
console.log(records.length, records[0].length, records[1].length);

const chosenIndex = 1;
const chosenRecord = records[chosenIndex];
const length = chosenRecord.readUInt32LE(0);
const result = JSON.parse(chosenRecord.subarray(4, 4+length).toString("utf8"));

console.log("Recovered IDs:", result.length, result.slice(0, 5));