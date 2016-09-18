import chalk from 'chalk';
import path from 'path';
import request from 'request';
import jsonFile from 'jsonfile';
import util from  'util';
import prompt from 'prompt';

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

    constructor (program) {
        this.program = program;
    }

    async action () {
        if (!this.program.user) {
            console.error('Username or Email is required');
            process.exit(1);
        }

        this.program.protocol = this.program.protocol == 'https' ? this.program.protocol : 'http';
        if (!parseInt(this.program.port)) {
            console.error('API port should be an integer');
            process.exit(1);
        }

        var configFile = path.join(__dirname, '.config.json');

        var self         = this,
            properties   = [
                {
                    name       : 'password',
                    description: chalk.red('Enter your password to connect to API:'),
                    hidden     : true,
                    required   : true,
                    replace    : '*'
                }
            ];

        prompt.message   = '';
        prompt.delimiter = '';
        prompt.start();

        prompt.get(properties, function (err, result) {
            if (err) {
                if (err.message !== 'canceled') {
                    console.log(err);
                } else {
                    console.log(chalk.red('User has cancelled.'));
                }
                prompt.stop();
                process.exit(1);
            }

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
            prompt.stop();
        });
    }
}


module.exports = ApiConfigurationCommand;
