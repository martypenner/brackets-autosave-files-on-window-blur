/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/**
 * Autosaves all files when leaving Brackets, a la PHPStorm.
 *
 * The main sequential function to save files is essentially copied from _saveFileList()
 * in document/DocumentCommandHandlers.js. The only modification is a check if the current
 * document in the loop is untitled (i.e. hasn't been saved to a permanent disk location).
 * If it is, don't bother trying to save it.
 */
define(function () {
    "use strict";
    
    var CommandManager = brackets.getModule("command/CommandManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        Async = brackets.getModule("utils/Async");

    /** Unique token used to indicate user-driven cancellation of Save As (as opposed to file IO error) */
    var USER_CANCELED = { userCanceled: true };
    
    $(window).on("blur", function () {
        // Do in serial because doSave shows error UI for each file, and we don't want to stack
        // multiple dialogs on top of each other
        var userCanceled = false;

        return Async.doSequentially(
            DocumentManager.getWorkingSet(),
            function (file) {
                // Abort remaining saves if user canceled any Save dialog
                if (userCanceled) {
                    return (new $.Deferred()).reject().promise();
                }

                var doc = DocumentManager.getOpenDocumentForPath(file.fullPath);
                if (doc && !doc.isUntitled()) {
                    var savePromise = CommandManager.execute("file.save", {doc: doc});
                    savePromise
                        .done(function (newFile) {
                            file.fullPath = newFile.fullPath;
                            file.name = newFile.name;
                        })
                        .fail(function (error) {
                            if (error === USER_CANCELED) {
                                userCanceled = true;
                            }
                        });

                    return savePromise;
                } else {
                    // working set entry that was never actually opened - ignore
                    return (new $.Deferred()).resolve().promise();
                }
            },
            false
        );
    });
});
