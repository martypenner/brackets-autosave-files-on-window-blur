/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** Autosaves all files when leaving Brackets, a la PHPStorm */
define(function () {
    "use strict";
    
    var CommandManager = brackets.getModule('command/CommandManager');
    
    $(window).on('blur', function () {
        CommandManager.execute("file.saveAll");
    });
});
