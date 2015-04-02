var spawn = require('child_process').spawn;
var Youtube = require('youtube-api');

var DEFAULT_DOWNLOAD_DIRECTORY = '~/Desktop/youtube-audio-downloader';
var filePrefix = 'file';
var MAX_RESULTS = 20;
var SONG_SLOTS = 5;
exports.DEFAULT_ARTIST = 'Justin Bieber';
exports.MAX_RESULTS = MAX_RESULTS;
exports.SONG_SLOTS = SONG_SLOTS;
exports.DEFAULT_DOWNLOAD_DIRECTORY = DEFAULT_DOWNLOAD_DIRECTORY;
exports.progress = [];
exports.songs = []; // metadata about every song
exports.visibleSongs = []; // songs seen by the user
exports.directory = DEFAULT_DOWNLOAD_DIRECTORY;

/*
Save metaData about every song.
*/
exports.search = function(artist, clientCallback) {
    findVideos(artist, function(err) {
        if (err) {
            console.log(err);
        }
        exports.visibleSongs = exports.songs.slice(0, SONG_SLOTS);
        exports.songs.splice(0, SONG_SLOTS);
        clientCallback();
   });
};

/*
duration: ISO 8601 String
returns: Object with minutes und seconds
*/
var extractDuration = function(duration) {
    var regex = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
    var hours = 0, minutes = 0, seconds = 0;
    var matches = regex.exec(duration);
    if (matches[1]) {
        hours = matches[1];
    }
    if (matches[2]) {
        minutes = matches[2];
    }
    if (matches[3]) {
        seconds = matches[3];
    } 

    return {
        hours: hours,
        minutes: minutes,
        seconds: seconds
    };
};

/*
callback: is called once for every video resource.
returns: meta data object with detailed video information of a single video.
*/
var findVideos = function(keyword, callback) {
    Youtube.search.list({
        q: keyword,
        part: 'id,snippet',
        type: 'video',
        maxResults: MAX_RESULTS
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

                var duration = extractDuration(data.items[0].contentDetails.duration);
                var metaData = {
                    URL: 'https://www.youtube.com/watch?v=' + data.items[0].id,
                    title: data.items[0].snippet.title,
                    thumbnail: data.items[0].snippet.thumbnails.default.url,
                    hours: duration.hours,
                    minutes: duration.minutes,
                    seconds: duration.seconds
                };
                exports.songs.push(metaData);
                if (exports.songs.length == MAX_RESULTS) {
                    callback(null);
                }
            });
        }
    });
};

/*
Download a single Song.
Uses 'spawn' instead of 'exec' so that the download progress can be fetched.
In order to filter the stdout output, every process has a unique id.
*/
var download = function(URL, path, index, callback) {
    var fileName = filePrefix + index;
    var process = spawn('python', ['./youtube-dl','-o', path+'/'+fileName+'.%(ext)s', '--newline', '--extract-audio', '--audio-format', 'mp3', URL]);
    process.id = index;

    process.stdout.on('data', function(data) {
        exports.progress[process.id] = data;
        //console.log(process.id+'stdout: ' + data);
    });
    process.stderr.on('data', function(data) {
        console.log(process.id+'stderr: ' + data);
    });
    process.on('close', function(code) {
        exports.progress[process.id] = 'Download complete.';
        console.log(process.id+'child process exited with code ' + code);
    });
};

/*
Download an Array of Songs.
*/
var downloadSongs = function(URLs) {
    for (var i = 0; i < URLs.length; i++) {
        download(URLs[i], exports.directory,  i, function(error) {
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

/*
Start the download process manually.
*/
exports.start = function() {
    var urls = [];
    for (var i = 0; i < SONG_SLOTS; i++) {
        urls[i] = exports.visibleSongs[i].URL;
    }
    downloadSongs(urls);
};

