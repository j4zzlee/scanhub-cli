var chalk       = require('chalk');
var fs          = require('fs');
var path        = require('path');
var md5         = require('md5');
var request     = require('request');
var jsonFile    = require('jsonfile');
var progress    = require('progress-stream');
var ProgressBar = require('node-status');

class ScanUploadCommand {
    progressBar;
    static command = {
        name       : 'scan:upload',
        description: 'Upload scan',
        options    : [
            {
                name       : '-r --repository <repository>',
                description: 'Repository name (slug)'
            },
            {
                name       : '-f --file <file>',
                description: 'Path to nmap file'
            }
        ]
    };

    constructor(program) {
        this.program = program;
    }


    registerProgressBar(totalCount) {
        this.progressBar = ProgressBar.addItem("Uploaded", {
            type: ['bar', 'percentage'],
            max : totalCount
        });

        ProgressBar.start();
    }

    async action() {
        try {
            var configFile = './.config.json';

            if (!fs.existsSync(configFile)) {
                console.error('You are not configure API Endpoint yet. Please use api:configure command to configure it.');
                return;
            }

            var configs    = jsonFile.readFileSync(configFile),
                repository = this.program.repository;
            var req        = request.post(
                {
                    url    : configs.endpoint + 'repositories/' + repository + '/scans/upload',
                    headers: {
                        api_key: configs.apiKey
                    }
                },
                function (err, resp, body) {
                    if (err) {
                        console.log(chalk.red(err));
                        process.exit(1);
                    }

                    if (body && typeof body === 'string') {
                        body = JSON.parse(body);
                    }

                    if (body.errorMessage) {
                        console.log(chalk.red(body.errorMessage));
                        process.exit(1);
                    }
                }
            );

            var form = req.form();

            this.registerProgressBar(100);

            //Progress bar
            var prevProgress = 0,
                stat         = fs.statSync(this.program.file),
                readProgress = progress({
                    length: stat.size,
                    time  : 100
                });

            readProgress.on('progress', (progress) => {
                this.progressBar.inc(progress.percentage - prevProgress);
                prevProgress = progress.percentage;

                if (prevProgress >= 100) {
                    ProgressBar.stop();
                }
            });

            var readStream = fs.createReadStream(this.program.file);
            readStream.pipe(readProgress);

            //Append multipart upload
            form.append('nmap', readStream);
        } catch (err) {
            console.log('Could not read file. Error: ' + err.message);
            process.exit(1);
        }
    }
}


module.exports = ScanUploadCommand;