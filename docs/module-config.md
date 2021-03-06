@typedef {*} @config
@parent StealJS.modules

@option {*} The `@config` module is loaded prior to the [@dev] and [config.main] module
in [config.env development] and assumed to be packaged in [config.bundlesPath bundle] in
production.

If `paths["@config"]` is not specified, its default path will obey the following rules:

 - If `steal.js` is in <i>ROOT/bower_components/steal/steal.js</i>, `@config` will be looked for in
   <i>ROOT/stealconfig.js</i>.
 - Otherwise, it will be looked for in _[config.baseURL baseURL]/stealconfig.js_.

@body

## Use

The path to `@config` is typically specified with [config.configPath] in the steal.js `<script>` tag like:

    <script src="../path/to/steal/steal.js"
            config-path="../path/to/stealconfig.js"
            main="app">
    </script>

But it can be specified with any of the approaches in [config.config].

