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

    /** Unique token used to indicate user-driven cancellation of Save As (as opposed to file IO error) */
    var USER_CANCELED = {userCanceled: true};
    /** Namespaced name of this module */
    var MODULE_NAME = 'martypenner.autosave-files-on-window-blur';
    /** Name of the preference used to store whether we're enabled or not */
    var PREF_NAME = MODULE_NAME + '.enabled';
    /** Name the command package-style to avoid collisions */
    var ENABLE_COMMAND_ID = PREF_NAME;

    var AppInit            = require('utils/AppInit'),
        CommandManager     = require('command/CommandManager'),
        Commands           = require('command/Commands'),
        DocumentManager    = require('document/DocumentManager'),
        MainViewManager    = require('view/MainViewManager'),
        Async              = require('utils/Async'),
        PreferencesManager = require('preferences/PreferencesManager'),
        Menus              = require('command/Menus');

    var prefs = PreferencesManager.getExtensionPrefs(MODULE_NAME);

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
     * @private
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

    /**
     * Save all changed (but not untitled) documents when Brackets loses focus
     *
     * @private
     */
    function _blurHandler() {
        _saveFileList(MainViewManager.getWorkingSet(MainViewManager.ALL_PANES));
    }

    /**
     * Add/remove event listeners for the window blur event
     *
     * @param {boolean} preference
     * @private
     */
    function _setupEventListeners(preference) {
        if (!preference) {
            $(window).off('blur', _blurHandler);
        } else {
            $(window).on('blur', _blurHandler);
        }
    }

    /**
     * Create a function that will toggle the named preference.
     *
     * @param {string} prefName Name of preference that should be toggled by the function
     * @private
     */
    function _getToggler(prefName) {
        return function () {
            var newPreference = !PreferencesManager.get(prefName);
            PreferencesManager.set(prefName, newPreference);

            _updateCheckedState(newPreference);
            _setupEventListeners(newPreference);
        };
    }

    /**
     * Update the command checked status based on the preference name given.
     *
     * @param {boolean} isChecked Whether to set the menu item to enabled or not
     * @private
     */
    function _updateCheckedState(isChecked) {
        CommandManager.get(ENABLE_COMMAND_ID).setChecked(isChecked);
    }

    /**
     * Kick things off.
     *
     * @private
     */
    function _init() {
        prefs.definePreference(PREF_NAME, 'boolean', true);
        prefs.on('change', function () {
            // This gets the current value of "enabled" where current means for the
            // file being edited right now.
            _updateCheckedState(prefs.get(PREF_NAME));
        });
        prefs.save();

        // First, register a command - a UI-less object associating an id to a handler
        CommandManager.register('Enable Autosave On Window Blur', ENABLE_COMMAND_ID, _getToggler(PREF_NAME));

        var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
        // Add the menu item and keyboard shortcut
        // (Note: "Ctrl" is automatically mapped to "Cmd" on Mac)
        menu.addMenuItem(ENABLE_COMMAND_ID, 'Ctrl-Alt-Shift-W');

        _setupEventListeners(prefs.get(PREF_NAME));
    }

    AppInit.htmlReady(_init);
});
