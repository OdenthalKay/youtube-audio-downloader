var spawn = require('child_process').spawn;
var Youtube = require('youtube-api');

var processes = [];
var DEFAULT_DOWNLOAD_DIRECTORY = '~/Desktop/songs';
var filePrefix = 'file';
var MAX_RESULTS = 30;
var SONG_SLOTS = 10;
exports.DEFAULT_ARTIST = 'Justin Bieber';
exports.MAX_RESULTS = MAX_RESULTS;
exports.SONG_SLOTS = SONG_SLOTS;
exports.DEFAULT_DOWNLOAD_DIRECTORY = DEFAULT_DOWNLOAD_DIRECTORY;
exports.progress = [];
exports.songs = []; // metadata about every song
exports.visibleSongs = []; // songs seen by the user
exports.directory = DEFAULT_DOWNLOAD_DIRECTORY;
exports.isDownloadActive = false;

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
                    seconds: duration.seconds,
                    checked: false
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
var download = function(song, path, callback) {
    console.log(song);
    var process = spawn('python', ['./youtube-dl','-o', path+'/'+'%(title)s.%(ext)s', '--newline', '--no-continue', '--extract-audio', '--audio-format', 'mp3', song.url]);
    processes.push(process);
    process.id = song.index;

    process.stdout.on('data', function(data) {
        exports.progress[process.id] = data;
        //console.log(process.id+'stdout: ' + data);
    });
    process.stderr.on('data', function(data) {
        console.log(process.id+'stderr: ' + data);
    });
    process.on('close', function(code) { 
        if (code == 0) {
            exports.progress[process.id] = 'Download complete.';
        } 
        
        console.log(process.id+'child process exited with code ' + code);
    });
};

/*
Download an Array of Songs.
*/
var downloadSongs = function(songs) {
    for (var i = 0; i < songs.length; i++) {
        download(songs[i], exports.directory, function(error) {
            if (error) {
                console.log(error);
            }
        });
    };
};

exports.cancelDownloads = function() {
    for (var i = 0; i < processes.length; i++) {
        console.log('killing process.');
        processes[i].kill('SIGINT');
    }
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
    //var urls = [];
    var songs = [];
    for (var i = 0; i < SONG_SLOTS; i++) {
        // Only download songs that have been checked by the user
        if (exports.visibleSongs[i].checked) {
            //urls.push(exports.visibleSongs[i].URL);
            var downloadSong = {
                url: exports.visibleSongs[i].URL,
                index: i
            };
            songs.push(downloadSong);
        }
    }
    downloadSongs(songs);
};

