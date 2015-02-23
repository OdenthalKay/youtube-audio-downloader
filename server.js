//var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var Youtube = require('youtube-api');

var filePrefix = 'file';
var MAX_RESULTS = 2;
var DEFAULT_ARTIST = "Herbert Grönemeyer";
var DEFAULT_PATH = "~/Music/youtube-mp3-download";

var path = DEFAULT_PATH;
var artist = DEFAULT_ARTIST;

/*
duration: ISO 8601 String
returns: Object with minutes und seconds
*/
var extractMinutesAndSeconds = function(duration) {
    var regex = /PT(.*?)M(.*?)S/g;
    var match = regex.exec(duration);
    return {
        minutes: match[1],
        seconds: match[2]
    }
};

/*
callback: is called once for every video resource.
returns: meta data object with detailed video information of a single video.
*/
var findVideos = function(keyword, maxResults, callback) {
    Youtube.search.list({
        q: keyword,
        part: 'id,snippet',
        type: 'video',
        maxResults: maxResults
    }, function(err, data) {
        if (err) {
            return callback(new Error('Failed to find youtube videos. Reason: ' + err.message));
        }

        // Find detailed information about every video resource
        for (var i = 0; i < data.items.length; i++) {
            Youtube.videos.list({
                id: data.items[i].id.videoId,
                part: 'contentDetails,snippet'
            }, function(err, data) {
                if (err) {
                    return callback(new Error('Failed to find detailed video information. Reason: ' + err.message));
                }

                // return meta data object
                var duration = extractMinutesAndSeconds(data.items[0].contentDetails.duration);
                var metaData = {
                    URL: 'https://www.youtube.com/watch?v=' + data.items[0].id,
                    title: data.items[0].snippet.title,
                    minutes: duration.minutes,
                    seconds: duration.seconds
                };

                callback(null, metaData);
            });
        }
    });
};

/*
Download a single Song.
Uses 'spawn' instead of 'exec' so that the download progress can be fetched.
In order to filter the stdout output, every process has a unique id.
*/
var download = function(URL, index, callback) {
    var fileName = filePrefix + index;
    var process = spawn('youtube-dl', ['-o', path+'/'+fileName+'.%(ext)s', '--newline', '--extract-audio', '--audio-format', 'mp3', URL]);
    process.id = index;

    process.stdout.on('data', function(data) {
        console.log(process.id+'stdout: ' + data);
    });
    process.stderr.on('data', function(data) {
        console.log(process.id+'stderr: ' + data);
    });
    process.on('close', function(code) {
        console.log(process.id+'child process exited with code ' + code);
    });
};

/*
Download an Array of Songs.
*/
var downloadSongs = function(URLs) {
    for (var i = 0; i < URLs.length; i++) {
        download(URLs[i], i, function(error) {
            if (error) {
                console.log(error);
            }
        });
    };
};

/*
Create zip archive containing all the audio files within the audio folder.
*/
var zipFiles = function(callback) {
    console.log('zipping files...');
    var command = 'zip -r files.zip audio';
    exec(command, function(error, stdout, stderr) {
        if (error) {
            return callback(new Error('Failed to zip files. Reason: ' + error.message));
        }
        callback(null);
        console.log('finished zipping files');
    });
};

/////////////////////////////////////////////////////////////////////////////////

Youtube.authenticate({
    type: "key",
    key: "AIzaSyCUS64-tEZ663s3vLyEdyet1lMJU2rn1-c"
});


var assignCommandLineParameters = function() {
if (process.argv.length < 3) {
        console.log('You must provide an Artist. Usage: server.js ARTIST [PATH]');
        process.exit(1);
    } else if (process.argv.length > 4) {
        console.log('Too many arguments. Usage: server.js ARTIST [PATH]');
        process.exit(1);
    }
    artist = process.argv[2];
    if (process.argv[3]) {
        path = process.argv[3];
    } else {
        console.log('No path specified. Using default: '+DEFAULT_PATH);
    }
    console.log('--- SEARCH INFORMATION --- ');
    console.log('Artist: '+artist);
    console.log('Output Path: '+path);
    console.log('--------------------------');
};

var main = function() {
    assignCommandLineParameters();

    // Download Songs
    var urls = [];
    findVideos(artist, MAX_RESULTS, function(err, metaData) {
        if (err) {
            console.log(err);
        }

        urls[urls.length] = metaData.URL;
        console.log(metaData);
        // start audio extraction
        if (urls.length == MAX_RESULTS) {
           return downloadSongs(urls);
       }
   });
};
main();
