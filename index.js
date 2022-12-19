const express = require('express')
const app = express()
const http = require('http');
let download = require('download');
const server = http.createServer(app);
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((_, res, next) => {
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });


app.use(express.static('public_html'));

var cookieParser = require('cookie-parser');
var session = require('express-session')
app.use(cookieParser());
app.use(session({
    secret: '34SDgsdgspxxxxxxxdfsG', // just a long random string
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: false
    }
}));


function change_name(path){
    const ls=fs.readdirSync(`${__dirname}/videos`);
    for (let i = 0; i < ls.length; i++) {
        if(ls[i] === path) fs.unlinkSync(`${__dirname}/videos/${path}`)
    }
    for (let j = 0; j < ls.length; j++) {
        if(ls[j] === `-edit-${path}`)
            fs.rename(`${__dirname}/videos/${ls[j]}`,
                `${__dirname}/videos/${path}`, err => {
                    if ( err ) console.log('ERROR: ' + err);
                    else console.log('Name changed')
            })
    }

}
const multer = require("multer");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, `${__dirname}/videos`)
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    },
})
const upload = multer({ storage: storage })


app.post('/upload', upload.single("my-video"), async (req, res, next) => {
    console.log(`Video uploaded: ${req.file.filename}`)
    req.session.video = req.file.filename
    res.sendFile(`${__dirname}/public_html/filter.html`);
})

app.post('/save' , async (req, res, next) => {
    let link = req.body.url
    const urlObject = new URL(link);
    const hostName = urlObject.hostname;

    if (hostName == 'www.dropbox.com') {
        var firstPart = link.split("=")[0];
        link = firstPart + '=1';
    }
    const filePath = `${__dirname}/videos`;
    await download(link, filePath)
        .then((res) => {
            var ls = fs.readdirSync(`${__dirname}/videos`);
            for (let index = 0; index < ls.length; index++) {
                if (link.includes(ls[index])) {
                    if (!ls[index].includes("mp4") && !ls[index].includes("avi")) {
                        next(new Error('Aquesta extensio no esta permesa'))
                    }
                    req.session.video = ls[index]
                }
            }
            console.log('Download Completed');
        })
    res.sendFile(`${__dirname}/public_html/filter.html`);
});

app.get('/download' , async (req, res, next) => {
    const path = `${__dirname}/videos/${req.session.video}`
    res.download(path , (err) => {
        if (err) {
            res.status(500).send({
                message: "Could not download the file. " + err,
            });
        }
        console.log('Download Completed');
    });
});

app.get('/videoplayer' , (req, res) => {
    const range = req.headers.range
    const videoPath = `videos/${req.session.video}`;
    const videoSize = fs.statSync(videoPath).size
    const chunkSize = 1e6;
    const start = Number(range.replace(/\D/g, ""))
    const end = Math.min(start + chunkSize, videoSize - 1)
    const contentLength = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mkv, video/mp4"
    }

    res.writeHead(206, headers)
    const stream = fs.createReadStream(videoPath, {
        start,
        end
    })
    stream.pipe(res)
});

app.post('/edit', async (req, res) => {
    const path = `${__dirname}/videos/${req.session.video}`
    const output = `${__dirname}/videos/-edit-${req.session.video}`;
    if (req.body.escalar){
        await new Promise((resolve,reject)=> {
            ffmpeg(path) //Input Video File
                .output(output) // Output File
                .videoCodec('libx264') // Video Codec
                .videoFilters(`scale=${req.body.escalar}`)
                .on('progress', function (data) {
                    console.log(data.percent);
                })
                .on('end', async function (err) {
                    if (!err) {
                        await change_name(req.session.video)
                        console.log("Conversion Done");
                        resolve()
                    }
                    reject(err)
                })
                .on('error', function (err) {
                    console.log('error: ' + err);
                    reject(err)
                }).run();
        });
    }
    if (req.body.velocitat){
        await new Promise((resolve,reject)=> {
            ffmpeg(path)
                .audioCodec('libmp3lame') // Audio Codec
                .videoCodec('libx264')
                .videoFilters(`setpts=${req.body.velocitat}*PTS`)
                .output(output)
                .on('end', async function (err) {
                    if (!err) {
                        await change_name(req.session.video)
                        console.log("Conversion Done")
                        resolve()
                    }
                    reject(err)
                })
                .on('progress', function (data) {
                    console.log(data.percent);
                })
                .on('error', function (err) {
                    console.log('error: ' + err);
                    reject(err)
                }).run();
        })
    }
    if (req.body.volum) {
        await new Promise((resolve,reject)=> {
            ffmpeg(path)
                .videoCodec('libx264')
                .audioFilters(`volume=${req.body.volum}`)
                .output(output)
                .on('end', async function (err) {
                    if (!err) {
                        await change_name(req.session.video)
                        console.log("Conversion Done")
                        resolve()
                    }
                    reject(err)
                })
                .on('progress', function (data) {
                    console.log(data.percent);
                })
                .on('error', function (err) {
                    console.log('error: ' + err);
                    reject(err)
                }).run();
        });
    }
    res.sendFile(`${__dirname}/public_html/download.html`);
})


server.listen(3000, () => {
    console.log('Https web server is listening on port ' + 3000);
});

