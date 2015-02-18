/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/**
 * Autosaves all files when leaving Brackets, in the style of PHPStorm/WebStorm.
 *
 * The functions are essentially copied from document/DocumentCommandHandlers.js. The only
 * modification is a check if the current document in the loop is untitled (i.e. hasn't
 * been saved to a permanent disk location). If it is, don't bother trying to save it.
 */
define(function () {
    'use strict';
    
    var CommandManager  = brackets.getModule('command/CommandManager'),
        Commands        = brackets.getModule('command/Commands'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        MainViewManager = brackets.getModule("view/MainViewManager"),
        Async           = brackets.getModule('utils/Async');

    /** Unique token used to indicate user-driven cancellation of Save As (as opposed to file IO error) */
    var USER_CANCELED = { userCanceled: true };
    
     /**
     * Saves all unsaved documents. Returns a Promise that will be resolved once ALL the save
     * operations have been completed. If ANY save operation fails, an error dialog is immediately
     * shown but after dismissing we continue saving the other files; after all files have been
     * processed, the Promise is rejected if any ONE save operation failed (the error given is the
     * first one encountered). If the user cancels any Save As dialog (for untitled files), the
     * Promise is immediately rejected.
     *
     * @param {!Array.<File>} fileList
     * @return {!$.Promise} Resolved with {!Array.<File>}, which may differ from 'fileList'
     *      if any of the files were Unsaved documents. Or rejected with {?FileSystemError}.
     */
    function _saveFileList(fileList) {
        // Do in serial because doSave shows error UI for each file, and we don't want to stack
        // multiple dialogs on top of each other
        var userCanceled = false,
            filesAfterSave = [];
            
        return Async.doSequentially(
            fileList,
            function (file) {
                // Abort remaining saves if user canceled any Save As dialog
                if (userCanceled) {
                    return (new $.Deferred()).reject().promise();
                }
                
                var doc = DocumentManager.getOpenDocumentForPath(file.fullPath);
                if (doc && !doc.isUntitled()) {
                    var savePromise = CommandManager.execute(Commands.FILE_SAVE, {doc: doc});
                    savePromise
                        .done(function (newFile) {
                            filesAfterSave.push(newFile);
                        })
                        .fail(function (error) {
                            if (error === USER_CANCELED) {
                                userCanceled = true;
                            }
                        });
                    return savePromise;
                } else {
                    // working set entry that was never actually opened - ignore
                    filesAfterSave.push(file);
                    return (new $.Deferred()).resolve().promise();
                }
            },
            false  // if any save fails, continue trying to save other files anyway; then reject at end
        ).then(function () {
            return filesAfterSave;
        });
    }
    
    // Save all changed (but not untitled) documents when Brackets loses focus
    $(window).on('blur', function () {
        _saveFileList(MainViewManager.getWorkingSet(MainViewManager.ALL_PANES));
    });
});
