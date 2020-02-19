#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const exec = require('child_process').exec;
const Listr = require('listr');
const yargs = require('yargs');
const NODE_MODULES = 'node_modules';

// available commands
const COMMANDS = ['list', 'remove'];

const command_handlers = {
    listLinked(cwd, level = 0) {
        const modules = path.join(cwd, NODE_MODULES);
        const linked = getLinked(modules);
        if (linked.length) {
            linked.forEach(link => {
                const version = fs.readJsonSync(
                    path.join(modules, link, 'package.json')
                ).version;
                console.log(`${' '.repeat(level * 4)}${link} ${version}`);
                this.listLinked(path.join(modules, link), level + 1);
            });
        }
    },
    // only remove top level linked modules
    removeLinked(cwd, module) {
        const modules = path.join(cwd, NODE_MODULES);
        const linked = getLinked(modules).filter((v) => module ? v === module : true);
        if (linked.length) {
            const tasks = linked.map((link) => {
                return {
                    title: `unlinking "${link}"`,
                    task: () => new Promise((resolve) => {
                        exec(`yarn unlink ${link}`, (err) => {
                            if (!err) {
                                resolve();
                            }
                        })
                    })
                };
            });
            new Listr(tasks, { concurrent: true }).run().catch((err) => console.log(err));
        }
    }
};

// get all symbolic links
function getLinked(cwd) {
    return glob
        .sync('{@*/*,[^@]*}/', { cwd })
        .map(match => match.slice(0, -1))
        .filter(file => {
            const stat = fs.lstatSync(path.join(cwd, file));
            return stat.isSymbolicLink();
        });
}

// building help
const argv = yargs
    .usage('Usage: $0 <command> [options]')
    .command('list', 'list all linked modules')
    .command('remove', 'remove all linked modules')
    .example('$0 remove', 'remove linked modules')
    .completion('completion', () => COMMANDS)
    .argv;

// current dir
const cwd = process.cwd();
const cmd = argv._.shift() || COMMANDS[0];
const _func = command_handlers[`${cmd}Linked`];
if (!_func) {
    yargs.showHelp();
} else {
    _func.call(command_handlers, cwd, argv._.shift());
}
