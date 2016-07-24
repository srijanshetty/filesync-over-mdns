// Import modules
let fs = require( 'fs' );
let path = require( 'path' );
let hashFiles = require( 'hash-files' );
let helpers = require( './helpers' );

// Global constants
const ALGORITHM = 'sha256';
const syncDir = './dir';

// The fileIndex which stores all the files
let fileIndex = {};

// Initialize the syncing process
function initialize() {
  let files = fs.readdirSync( syncDir );
  for( file of files ) {
    addToSyncDir( path.join( syncDir, file ) );
  }
}

// Add a file to the localIndex
function addToSyncDir( filename, contents ) {
  let hash = hashFiles.sync( { algorithm: ALGORITHM, files: [ filename ] } );

  if( !fileIndex[ hash ] ) {
    helpers.logger( `FILEINDEX: Adding ${filename} to local Index.`, 5 );
    fileIndex[ hash ] = filename;

    // Write the contents if it's provided
    if( !!contents )  {
      fs.writeFile( path.join( syncDir, filename), contents, () => helpers.logger( `${filename} written to local dir.`, 5 ) );
    }
  } else {
    helpers.logger( `FILEINDEX: ${filename} is a copy.`, 5 );
    // TODO*: better handling of sync conflicts
  }
};

// Syncronize a peer's index with our index
function sync( peerIndex ) {
  return( {
    missingFiles: Object.keys( peerIndex ).filter( hash => !fileIndex[ hash ] ),
    extraFiles: Object.keys( fileIndex ).filter( hash => !peerIndex[ hash ] )
  } );
}

// Export functions
module.exports = {
  initialize: initialize,
  addToSyncDir: addToSyncDir,
  getIndex: () => fileIndex,
  sync: sync
};
