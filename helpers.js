HASH_ALGORITHM = 'sha256';

// print an error message
function error( message ) {
  process.stdout.write( '[ ERROR ] ' + message + '\n' );
}

// prompts the user with a question also checks regex
function ask( question, format, callback ) {
  var stdin = process.stdin;
  var stdout = process.stdout;

  stdin.resume();
  stdout.write( '[ ' + question + '\t]' + '\t >> ');

  stdin.once( 'data', function( data ) {
    data = data.toString().trim();

    if ( format.test( data ) ) {
      callback( data );
    } else {
      error( 'Should Match RegEx - ' + format + '\n');
      ask( question, format, callback );
    }
  } );
}

module.exports = {
  'ask': ask,
};
