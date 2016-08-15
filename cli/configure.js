var chalk    = require('chalk');
var fs       = require('fs');
var path     = require('path');
var md5      = require('md5');
var request  = require('request');
var jsonFile = require('jsonfile');
var prompt   = require('prompt');
var Promise  = require('bluebird');
var util     = require('util');
Promise.promisifyAll(prompt);

class ApiConfigurationCommand {
    static command = {
        name       : 'api:configure',
        description: 'Configure API Endpoint',
        options    : [
            {
                name       : '-u --user <user>',
                description: 'Username or email'
            },
            {
                name        : '-h --host <host>',
                description : 'The API host, defaults to "localhost"',
                defaultValue: 'localhost'
            },
            {
                name        : '-p --port <port>',
                description : 'The API port, defaults to 80',
                defaultValue: 80
            },
            {
                name        : '-l --protocol <protocol>',
                description : 'http/https. Defaults to http',
                defaultValue: 'http'
            }
        ]
    };

    constructor(program) {
        this.program = program;
    }

    async action() {
        try {
            if (!this.program.user) {
                console.error('Username or Email is required');
                process.exit(1);
            }

            this.program.protocol = this.program.protocol == 'https' ? this.program.protocol : 'http';
            if (!parseInt(this.program.port)) {
                console.error('API port should be an integer');
                process.exit(1);
            }

            var configFile = './.config.json';

            //ask for password
            var self       = this,
                properties = [
                    {
                        name       : 'password',
                        description: chalk.green('Enter your password to connect to API'),
                        hidden     : true,
                        required   : true
                    }
                ];

            prompt.message   = '';
            prompt.delimiter = '';

            prompt.start();

            // try {
            prompt.get(properties, function (err, result) {

                var options = {
                    method : 'GET',
                    url    : util.format('%s://%s:%s/api/1.0/users/%s',
                        self.program.protocol,
                        self.program.host,
                        self.program.port,
                        self.program.user),
                    headers: {
                        password: result.password
                    }
                };

                request(options, function (error, response, body) {
                    if (error) throw new Error(error);

                    if (typeof body === 'string') {
                        body = JSON.parse(body);
                    }

                    if (body.errorMessage) {
                        console.error(body.errorMessage);
                        process.exit(1);
                    }

                    jsonFile.writeFileSync(configFile, {
                        apiKey  : body.api_key,
                        endpoint: util.format('%s://%s:%s/api/1.0/',
                            self.program.protocol,
                            self.program.host,
                            self.program.port)
                    });

                    console.log('API Endpoint is configured successfully');

                    process.exit(0);
                });
            });
            // } catch (ex) {
            //     //User cancel
            //     process.exit(1);
            // }

        } catch (err) {
            console.log(err);
            process.exit(1);
        }
    }
}


module.exports = ApiConfigurationCommand;
