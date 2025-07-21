import * as fs from 'fs';
import * as config from 'config';

const BACKUP_FILE_POSTFIX = ".back";
const patchEntryRegex = /{\+([^}]+)}/g; // {+ABC} -> development.json/movetaOdbcConnection.ABC

export function performPatches(patches: {configurationBase: string, patchPaths: string[]}[]) {
    console.log("Patching external configuration files...");

    for (let entry of patches) {
        let configurationBase = config.get(entry.configurationBase);
        let paths = entry.patchPaths;
        console.log(" -", Object.keys(configurationBase).length + " entries", paths);

        for (let path of paths) {
            let backupFilePath = path + BACKUP_FILE_POSTFIX;
            console.log(" * " + path);
            // at least one placeholder is found in file, let's back it up before we overwrite the placeholders.
            let containsPlaceholders = fs.readFileSync(path, 'utf-8').match(patchEntryRegex) !== null;
            let backupExists = fs.existsSync(backupFilePath);

            if (containsPlaceholders) {
                if (!backupExists) {
                    fs.copyFileSync(path, backupFilePath);
                    console.log("   - Backup");
                } else {
                    console.log("   - Still contains entries to patch, but using backup as template!");
                }
            } else {
                console.log("   - No placeholders to patch!");
            }

            backupExists = fs.existsSync(backupFilePath);
            if (backupExists) {
                let backupContent = fs.readFileSync(backupFilePath, 'utf-8');
                let patchedContent = backupContent.replace(patchEntryRegex, (match, key) => {
                    return configurationBase[key] || match;
                });
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                    console.log("   - Delete");
                }
                fs.writeFileSync(path, patchedContent);
                console.log("   - Patch");
            } else {
                console.log("   - No backup to use as template!");
            }
        }
    }

    console.log("Done patching external configuration files!");
}