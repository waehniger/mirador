/*
 * All Endpoints need to have at least the following:
 * annotationsList - current list of OA Annotations
 * dfd - Deferred Object
 * init()
 * search(options, successCallback, errorCallback)
 * create(oaAnnotation, successCallback, errorCallback)
 * update(oaAnnotation, successCallback, errorCallback)
 * deleteAnnotation(annotationID, successCallback, errorCallback) (delete is a reserved word)
 * TODO:
 * read() //not currently used
 *
 * Optional, if endpoint is not OA compliant:
 * getAnnotationInOA(endpointAnnotation)
 * getAnnotationInEndpoint(oaAnnotation)
 */
(function($){

  $.WebAnnoEndpoint = function(options) {

    jQuery.extend(this, {
      token:     null,
      prefix:    null,
      params:    "",
      dfd:       null,
      context_id: "None",
      collection_id: "None",
      //userid:    "test@mirador.org",
      // username:  "mirador-test",
      annotationsList: [],        //OA list for Mirador use
      windowID: null,
      eventEmitter: null
    }, options);

    this.init();
  };

  $.WebAnnoEndpoint.prototype = {
    init: function() {
      //whatever initialization your endpoint needs
    },

    set: function(prop, value, options) {
      if (options) {
        this[options.parent][prop] = value;
      } else {
        this[prop] = value;
      }
    },

    //Search endpoint for all annotations with a given URI in options
    search: function(options, successCallback, errorCallback) {
      var _this = this;
      this.annotationsList = []; //clear out current list

      //use options.uri
      jQuery.ajax({
        url: _this.url+"?uri="+options.uri,
        cache: true, // https://stackoverflow.com/questions/16200121/ajax-without-querystring-parameter/16200134
        type: 'GET',
        dataType: 'json',
        headers: {
          "X-Anno-Collection": "default",
          "Accept": "application/ld+json"
        },
        data: {
          // uri: options.uri
         },
        contentType: "application/ld+json; charset=utf-8",
        success: function(data) {
          //check if a function has been passed in, otherwise, treat it as a normal search
          if (typeof successCallback === "function") {
            successCallback(data);
          } else {
            if (data.total != 0) {
            _this.annotationsList = data.first.items;
            jQuery.each(_this.annotationsList, function(index, value) {
              _this.annotationsList.push(_this.getAnnotationInOA(value));
            });
          }
            _this.dfd.resolve(true);
          }
        },
        error: function() {
          if (typeof errorCallback === "function") {
            errorCallback();
          } else {
            console.log("There was an error searching this endpoint");
          }
        }
      });
    },

    //Delete an annotation by endpoint identifier
    deleteAnnotation: function(annotationID, successCallback, errorCallback) {
      var _this = this;
      jQuery.ajax({
        url: annotationID,
        type: 'DELETE',
        dataType: 'json',
        headers: {
          "X-Anno-Collection": "default",
          "Accept": "application/ld+json",
          "X-Anno-Context": "http://www.w3.org/ns/anno.jsonld"
        },
        contentType: "application/json; charset=utf-8",
        success: function(data) {
          if (typeof successCallback === "function") {
            successCallback();
          }
        },
        error: function() {
          if (typeof errorCallback === "function") {
            errorCallback();
          }
        }
      });
    },

    //Update an annotation given the OA version
    update: function(oaAnnotation, successCallback, errorCallback) {
      var annotations = this.getAnnotationInEndpoint(oaAnnotation),
      _this = this;
      // why are several annotations possible
      annotations.forEach(function(annotation) {
        var annotationID = annotation.id;

        jQuery.ajax({
          url: annotationID,
          type: 'PUT',
          dataType: 'json',
          headers: {
            "X-Anno-Collection": "default",
            "Accept": "application/ld+json",
            "X-Anno-Context": "http://www.w3.org/ns/anno.jsonld"
          },
          data: JSON.stringify(annotation),
          contentType: "application/json; charset=utf-8",
          success: function(data) {
            if (typeof successCallback === "function") {
              successCallback(_this.getAnnotationInOA(data));
            }
          },
          error: function() {
            if (typeof errorCallback === "function") {
              errorCallback();
            }
          }
        });
      });
    },

    //takes OA Annotation, gets Endpoint Annotation, and saves
    //if successful, MUST return the OA rendering of the annotation
    create: function(oaAnnotation, successCallback, errorCallback) {
      var _this = this;
      annotations = this.getAnnotationInEndpoint(oaAnnotation);
      annotations.forEach(function(annotation) {
        _this.createWebAnnotation(annotation, successCallback, errorCallback);
      });
    },

    createWebAnnotation: function(webAnnotation, successCallback, errorCallback) {
      var _this = this;

      jQuery.ajax({
        url: _this.url,
        type: 'POST',
        dataType: 'json',
        headers: { },
        data: JSON.stringify(webAnnotation),
        contentType: "application/json; charset=utf-8",
        success: function(data) {
          if (typeof successCallback === "function") {
            successCallback(_this.getAnnotationInOA(data));
          }
          _this.eventEmitter.publish('catchAnnotationCreated.'+_this.windowID, data);
        },
        error: function() {
          if (typeof errorCallback === "function") {
            errorCallback();
          }
        }
      });
    },


    userAuthorize: function(action, annotation) {
        return true;
    },


    //Convert Endpoint annotation to OA
    getAnnotationInOA: function(annotation) {
      var id,
      resource = [],
      on = [];
      //annotatedBy;

      id = annotation.id;

      resource.push( {
        "@type" : "dctypes:Text",
        "format" : "text/html",
        "chars" : annotation.body.value
      });

      on.push( {
        "@type" : "oa:SpecificResource",
        "full" : annotation.uri, //on.full
        "selector" : {
          "@type" : "oa:Choice",
          "default" : {
            "@type" : "oa:FragmentSelector",
            "value" : annotation.target.selector.oa_svg_value
          },
          "item" : {
            "@type" : "oa:SvgSelector",
            "value" : annotation.target.selector.value
          }
        },
        "within" : {
          "@id" : annotation.target.manifest,
          "@type" : "sc:Manifest"
        }
      });

      var oaAnnotation = {
        "@context" : "http://iiif.io/api/presentation/2/context.json",
        "@id" : String(id),
        "@type" : "oa:Annotation",
        "motivation" : "oa:commenting",
        "resource" : resource,
        "on" : on,
        //"annotatedBy" : annotatedBy,
        "annotatedAt" : annotation.created,
        //"serializedAt" : annotation.updated,
        //"permissions" : annotation.permissions,
        "endpoint" : this
      };
      return oaAnnotation;
    },


    // Converts OA Annotation to endpoint format
    getAnnotationInEndpoint: function(oaAnnotation) {

      var _this = this,
      uris = [];
      oaAnnotation.on.forEach(function(value) {
        if (jQuery.inArray(value.full, uris) === -1) {
          uris.push(value.full);

        }
      });
      var annotations = [];

      uris.forEach(function(uri) {
        var annotation = {},
        tags = [],
        text;

        if (oaAnnotation["@id"]) {
          annotation.id = oaAnnotation["@id"];
        }

        annotation.type = "Annotation";
        annotation.created = "2015-01-31T12:03:45Z";

        annotation.uri = uri; //on.full

        jQuery.each(oaAnnotation.resource, function(index, value) {
          if (value['@type'] === 'oa:Tag') {
            tags.push(value.chars);
          } else if (value['@type'] === 'dctypes:Text') {
            text = value.chars;
          }
        });

        annotation.target = {};
        //imagesList gets image insearch
        annotation.target.type = "image";


        annotation.target.selector = {};
        annotation.target.selector.type = "SvgSelector";
        oaAnnotation.on.forEach(function(value) {
          annotation.target.selector.value = value.selector.item.value;
          annotation.target.selector.oa_svg_value = value.selector.default.value;
        });

        annotation.rights = "https://creativecommons.org/licenses/by/4.0/";
        annotation.creator = {};

        annotation.body = {};
        annotation.body.tags = tags;
        annotation.body.format = "text/html";
        annotation.body.type = "TextualBody";
        annotation.body.value = text;

        annotation.modified = new Date().toISOString();
        if (oaAnnotation.annotatedAt) {
          annotation.created = oaAnnotation.annotatedAt;
        } else {
          annotation.created = annotation.modified;
        }

        //TODO: use actual values for these fields
        annotation.target.source = "original.jpg";
        // annotation.creator.displayName = "test-user";
        // annotation.creator.id = "my.arthistoricum-user-id";
        // annotation.collection = "mirador_annos";

        // "via": "https://anno.ub.uni-heidelberg.de/anno/anno/C76UjkRNTxGJFtAvB3q3uA",
        // "doi": "10.11588/anno.diglit.C76UjkRNTxGJFtAvB3q3uA"

        annotations.push(annotation);
      });
      return annotations;
    }
  };

}(Mirador));
