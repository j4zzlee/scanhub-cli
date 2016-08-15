var chalk       = require('chalk');
var fs          = require('fs');
var path        = require('path');
var md5         = require('md5');
var request     = require('request');
var jsonFile    = require('jsonfile');
var prompt      = require('prompt');
var Promise     = require('bluebird');
var validator   = require('validator');
var urlencode   = require('urlencode');
var ProgressBar = require('node-status');
var extend      = require('extend');
var _           = require('lodash');
Promise.promisifyAll(request);

class SearchHostCommand {
    repository;
    output;
    endpoint;
    apiKey;
    progressBar;

    static command = {
        name       : 'search',
        description: 'Search hosts across the API',
        options    : [
            {
                name       : '--fields <fields>',
                description: 'Comma separated list of fields. E.g: --fields id,addresses,domains...'
            },
            {
                name       : '--facets <facets>',
                description: 'Comma separated list of facets based on predefined list of facets: operating_systems, addresses, ' +
                'domains, services, ports, aliases'
            },
            {
                name       : '--filters <filters>',
                description: 'Host filters, e.g: --filters addresses=192.168.1.1/24 AND ports=80'
            },
            {
                name       : '-o --output <output>',
                description: 'Download the results in JSON format to output folder'
            },
            {
                name       : '--repository <repository>',
                description: 'Repository name (slug) or id'
            }
        ]
    };

    getTargetOutput(output) {
        if (!output) {
            return null;
        }

        var file           = path.basename(output),
            filename       = file.substr(0, file.lastIndexOf('.') != -1 ? file.lastIndexOf('.') : file.length),
            generated      = filename,
            generatedCount = 1,
            extension      = file.replace(filename, '').replace('.', ''),
            dirname        = path.dirname(output);

        try {
            var stat = fs.lstatSync(output);
        } catch (ex) {
            //File does not exists, we will create it later
            stat = null
        }

        if (stat && stat.isDirectory()) {
            dirname   = output;
            filename  = 'hosts';
            generated = filename;
        }

        if (!extension) {
            extension = 'json';
        }

        output = path.join(dirname, generated + '.' + extension);
        while (fs.existsSync(output)) {
            generated = filename + '(' + generatedCount + ')';
            generatedCount++;
            output = path.join(dirname, generated + '.' + extension);
        }

        return output;
    }

    constructor(program) {
        this.program    = program;
        var repository  = this.program.repository || '',
            output      = this.program.output || '',
            configFile  = './.config.json';
        repository      = repository.trim();
        output          = output.trim();
        this.repository = repository || '';
        if (fs.existsSync(configFile)) {
            var configs   = jsonFile.readFileSync(configFile)
            this.endpoint = configs.endpoint;
            this.apiKey   = configs.apiKey;
        }

        this.output = this.getTargetOutput(output);
    }

    async search(fields, filters, facets, pageSize, pageIndex) {
        var query,
            queries = [];

        if (fields) {
            queries.push('fields=' + urlencode(fields));
        }

        if (filters) {
            queries.push('filters=' + urlencode(filters))
        }

        if (facets) {
            queries.push('facets=' + urlencode(facets))
        }

        if (pageSize) {
            queries.push('pageSize=' + urlencode(pageSize))
        }

        if (pageIndex) {
            queries.push('pageIndex=' + urlencode(pageIndex))
        }

        query = queries.join('&');
        query = query.trim();

        var url = this.endpoint
            + (this.repository ? 'repositories/' + this.repository + '/' : '')
            + 'hosts' + (query ? '?' + query : '');

        return await request.getAsync(
            {
                url    : url,
                headers: {
                    api_key: this.apiKey
                }
            }
        );
    }

    startSave() {
        this.output && fs.writeFileSync(this.output, '[');
    }

    endSave() {
        this.output && fs.appendFileSync(this.output, ']');
    }

    printProperty(title, value, valueIndent, titleIndent) {
        var defaultTitleIndent = 4,
            defaultValueIndent = 6;

        valueIndent = valueIndent || 0;
        titleIndent = titleIndent || 0;
        valueIndent = defaultValueIndent + valueIndent;
        titleIndent = defaultTitleIndent + titleIndent;
        console.log(Array(titleIndent).join(" ") + title + Array(valueIndent).join('\t') + (value || ''))
    }

    hasField(fieldName) {
        return !this.program.fields || this.program.fields.indexOf(fieldName) > -1;
    }

    printHost(host) {
        console.log(chalk.blue('* Host ID: ') + (host.id ? '#' + host.id : 'n/a'))

        if (this.hasField('state')) {
            this.printProperty(chalk.yellow('- State: '), host.state)
        }

        if (this.hasField('start_time')) {
            this.printProperty(chalk.yellow('- Start Time: '), host.start_time, -1)
        }

        if (this.hasField('end_time')) {
            this.printProperty(chalk.yellow('- End Time: '), host.end_time)
        }

        if (this.hasField('services')) {
            if (host.services && host.services.length) {
                this.printProperty(chalk.yellow('- Services: '), host.services.join(', '))
            } else {
                this.printProperty(chalk.yellow('- Services: '))
            }
        }

        if (this.hasField('ports')) {
            if (host.ports && host.ports.length) {
                this.printProperty(chalk.yellow('- Ports: '), host.ports.join(', '))
            } else {
                this.printProperty(chalk.yellow('- Ports: '))
            }
        }

        if (this.hasField('operating_systems')) {
            if (host.operating_systems && host.operating_systems.length) {
                this.printProperty(chalk.yellow('- OS: '), host.operating_systems.join(', '))
            } else {
                this.printProperty(chalk.yellow('- OS: '))
            }
        }

        if (this.hasField('aliases')) {
            if (host.aliases && host.aliases.length) {
                this.printProperty(chalk.yellow('- Aliases: '), host.aliases.join(', '))
            } else {
                this.printProperty(chalk.yellow('- Aliases: '))
            }
        }

        if (this.hasField('addresses')) {
            if (host.addresses && host.addresses.length) {
                this.printProperty(chalk.yellow('- Addresses: '), host.addresses.join(', '), -1)
            } else {
                this.printProperty(chalk.yellow('- Addresses: '))
            }
        }

        if (this.hasField('country')) {
            this.printProperty(chalk.yellow('- Country: '), host.country)
        }

        if (this.hasField('city')) {
            this.printProperty(chalk.yellow('- City: '), host.city)
        }

        if (this.hasField('region')) {
            this.printProperty(chalk.yellow('- Region: '), host.region)
        }

        if (this.hasField('lat')) {
            this.printProperty(chalk.yellow('- Latitude: '), host.lat)
        }

        if (this.hasField('lng')) {
            this.printProperty(chalk.yellow('- Longitude:'), host.lng)
        }

        if (this.hasField('domains')) {
            if (host.domains && host.domains.length) {
                this.printProperty(chalk.yellow('- Domains: '), host.domains.join(', '))
            } else {
                this.printProperty(chalk.yellow('- Domains: '))
            }
        }

        if (host.repository) {
            this.printProperty(chalk.yellow('- Repository: '))
            if (this.hasField('repository.id')) {
                this.printProperty(chalk.yellow('ID: '), host.repository.id, 0, 4)
            }

            if (this.hasField('repository.slug')) {
                this.printProperty(chalk.yellow('Slug: '), host.repository.slug, 0, 4)
            }

            if (this.hasField('repository.display_name')) {
                this.printProperty(chalk.yellow('Display Name: '), host.repository.display_name, -1, 4)
            }
        }

        if (this.hasField('scans')) {
            if (host.scans && Array.isArray(host.scans) && host.scans.length) {
                var isFirstOrder = true;
                for (var i = 0; i < host.scans.length; i++) {
                    var scan = host.scans[i];

                    if (isFirstOrder) {
                        this.printProperty(chalk.yellow('- Scan Args: '), scan, -1);
                        isFirstOrder = false;
                    } else {
                        this.printProperty('', scan, 1);
                    }
                }
            } else if (host.scans) {
                this.printProperty(chalk.yellow('- Scan Args: '), host.scans, -1);
            }
        }
    }

    save(hosts, downloadedCount, totalDownloadedCount, totalCount) {
        if (!hosts || !hosts.length) {
            ProgressBar.stop();
            return;
        }
        if (this.output) {
            if (!hosts || !hosts.length) {
                ProgressBar.stop();
                return;
            }

            for (var i = 0; i < hosts.length; i++) {
                var host = hosts[i];
                if (host.netmasks) {
                    delete host.netmasks;
                }

                //Save to output
                fs.appendFileSync(
                    this.output,
                    (totalDownloadedCount > downloadedCount || i > 0 ? ',' : '') + JSON.stringify(host, null, 4));

                this.progressBar.inc(1);
            }

            if (totalDownloadedCount >= totalCount) {
                ProgressBar.stop();
                this.endSave();
            }

            return;
        }

        //console.log
        if (!hosts || !hosts.length) {
            return;
        }

        for (var i = 0; i < hosts.length; i++) {
            this.printHost(hosts[i]);
        }

        if (totalDownloadedCount >= totalCount) {
            ProgressBar.stop();
        }
    };

    registerProgressBar(totalCount) {
        if (this.output) {
            this.progressBar = ProgressBar.addItem("Downloaded", {
                type: ['count', 'bar', 'percentage'],
                max : totalCount
            });

            ProgressBar.start();
        }
    }

    async action() {
        try {
            if (!this.apiKey) {
                console.error('You are not configure API Endpoint yet. Please use api:configure command to configure it.');
                return;
            }

            var pageSize  = 5,
                pageIndex = 1,
                resp      = await this.search(
                    this.program.fields,
                    this.program.filters,
                    this.program.facets,
                    pageSize,
                    pageIndex);

            if (resp.body) {
                var body         = JSON.parse(resp.body),
                    totalCount   = body.totalCount,
                    currentIndex = pageSize * pageIndex;

                if (resp.statusCode != 200) {
                    if (body.errorMessage) {
                        console.log(chalk.red(body.errorMessage));
                    }
                    switch (resp.statusCode) {
                        case 422:
                            break;
                        default:
                            console.log(chalk.red('Unexpected error occurred. Please contact your administrator for more information'));
                            console.error(resp);
                            break;
                    }

                    process.exit(1);
                }

                console.log(chalk.green('* Total hosts matched: \t\t') + totalCount);
                if (this.output) {
                    console.log(chalk.green('* Output file: \t\t\t') + this.output);
                }

                this.startSave();
                this.registerProgressBar(totalCount);
                this.save(body.data, pageSize, currentIndex, totalCount);

                while (totalCount > currentIndex) {
                    resp = await this.search(
                        this.program.fields,
                        this.program.filters,
                        this.program.facets,
                        pageSize,
                        ++pageIndex);

                    currentIndex = pageSize * pageIndex;
                    if (!resp.body) {
                        break;
                    }

                    body = JSON.parse(resp.body);
                    this.save(body.data, pageSize, currentIndex, totalCount);
                }

            } else {
                //No results
                console.log('The request returns empty result.');
            }

        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
}


module.exports = SearchHostCommand;
