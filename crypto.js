let ALGORITHM = 'sha256';
let FILE_INDEX= '.index';
// let SEARCH_INDEX = '.search';

let fs = require( 'fs' );
let hashFiles = require( 'hash-files' );

let fileIndex = fs.readFileSync( FILE_INDEX );
// let searchIndex = fs.readFileSync( SEARCH_INDEX );

module.exports = {};

module.addHash = function ( filename ) {
  let hash = hashFiles.sync( { algorithm: ALGORITHM, files: [ filename ] } );
  fileIndex[ hash ] = filename;
  // TODO: Save the file
};

