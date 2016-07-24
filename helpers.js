const HASH_ALGORITHM = 'sha256';
const LOG_LEVEL = 10;

module.exports = {};

// Get the idenfier for the host
module.exports.hostIdentifier = function( host, port ) {
    return host + '::' + port;
}

// Get the normalized IP
module.exports.simpleHost = function( host ) {
  let indexOfColon = host.lastIndexOf(':');
  let newHost = host.substring( indexOfColon + 1, host.length );
  return( newHost );
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
module.exports.logger = function logger( message, level = 1 ) {
  if( level <= LOG_LEVEL )
    console.log( '[ INFO ] %s', message );
}

// print an error message
module.exports.error = function ( message, level ) {
  if( level < LOG_LEVEL )
    console.log( '[ ERROR ] %s', message );
}

