HASH_ALGORITHM = 'sha256';

module.exports = {};

// Get the idenfier for the host
module.exports.hostIdentifier = function( host, port ) {
    return host + '::' + port;
}

// prompts the user with a question also checks regex
module.exports.ask = function( question, format, callback ) {
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

// Log out messages to the console
module.exports.logger = function logger( message ) {
  console.log( '[ INFO ] %s\n', message );
}

// print an error message
module.exports.error = function ( message ) {
  console.log( '[ ERROR ] %s\n', message );
}

