/**
 * Simple movie suggestion class. Given a set of movie names, suggests movies with the same actors in them.
 * This could of course be made more awesome by checking for genre, director, producer and so on, but the point
 * is to show the client-side data mashup.
 * @author Jacob Hansson <jacob@voltvoodoo.com>
 */
var SuggestionEngine = function() {

   var self = this;

   //
   // PRIVATE
   //

   /**
    * Get info about a movie given its name. This will
    * trigger an asynchronous call to a Neo4j instance
    * running a limited IMDB example set.
    * @param {string} the movie name
    * @param {function} callback called with a list of 
    * movie objects ([{ id:ID, title:TITLE },..])
    */ 
   self.movie_info = function( movie_name, callback ) {
      // The search API uses commas for AND-type searches, spaces become OR, so for
      // the movie names, we switch spaces out for commas.
      movie_name = movie_name.replace(/ /g, ",");
      FB.api("imdb:/search", {type:'movie', q:movie_name }, callback );
   };

   /**
    * Get one movie that a given actor has been in, leaving out any
    * movies in blacklist.
    * @param {array}    array of {count:NUM_MOVIES, data:ACTOR_OBJECT } objects, in ascending order of importance
    * @param {array}    array of movies to exclude
    * @param {function} callback called with resulting movie.
    */
   self.movie_by_actor = function( actors, blacklist, callback ) {
      if ( actors.length > 0 ) {
          var actor = actors.pop().data;
          FB.api("imdb:/" + actor.id + "/acted_in", function( result ) {
             
             var blacklisted, current_movie;
             for (var i = 0; i < result.data.length; i++) {
                blacklisted   = false;
                current_movie = result.data[i];

                // Check blacklist
                for ( var o = 0; o < blacklist.length; o++) {
                   if( blacklist[o].id == current_movie.id ) {
                      blacklisted = true;
                      break;
                   }
                }

                // Go to next movie if the current one was in the blacklist
                if ( blacklisted ) continue;
             
                // Found a match!
                // Add the star actor to this movie
                current_movie.star = actor;
                callback( current_movie );
                return;
             }

             // No movie was found :(
             return self.movie_by_actor( actors, blacklist, callback );
             
          });
       } else {
          callback ( {'message':"No movies found.", 'error': 2 } );
       }
   };

   /**
    * Suggest a movie given a set of movie names.
    * This will try to find actors that play in several of
    * the movies in movie_names, and then find a movie not in the
    * movie_names list, that features the top actor.
    *
    * A somewhat juvenile attempt at a suggestion engine, but the point
    * here is of course to build a working example to give you an idea
    * of something that can be done with the external database extension to
    * facebooks graph API.
    *
    * @param {array} movie_names
    * @param {function} callback will be called with the resulting movie or with an error object.
    *
    * The movie object will have the following format:
    * { title : TITLE, id : ID, star : { name:NAME_OF_ACTOR_THAT_LEAD_TO_RECOMMENDATION, id : ACTOR_ID } }
    *
    * Each error object will have a message parameter and an error parameter. Error parameters can be:
    *    1 - There were no movies found in IMDB that matched the movie names provided
    *    2 - Given the top actor in the movies provided, there are no movies he or she stars in that was
    *        not already in the list of movie names (ie. you've already seen all the movies).
    */
   self.suggest = function( movie_names, callback ) {
      var actors = {},
          movies = {},
          movie_requests = movie_names.length,
          actor_requests = 0;

      // Called once for each movie returned by IMDB
      function process_movie( result_movies ) {
         movie_requests--;
         
         // Each movie
         for ( var i = 0; i < result_movies.length; i++ ) {
            
            // Save movie
            if ( typeof( movies[result_movies[i].id] ) == "undefined" ) {
               movies[result_movies[i].id] = result_movies[i];
            }

            // Get actors
            actor_requests++;
            FB.api("imdb:/" + result_movies[i].id + "/actors", function(result) {
               for( var i=0;i<result.data.length;i++) {
                  var actor = result.data[i];

                  // Save actor
                  if ( typeof( actors[actor.id] ) == "undefined" ) {
                     actors[actor.id] = { count:0, data:actor };
                  }

                  // Keep track of how many times this actor has occurred
                  actors[actor.id].count ++;
               }

               actor_requests--;
               if ( actor_requests <= 0 && movie_requests <= 0) {
                  // All actors and all movies have been requested!

                  // XXX: Quick hack
                  // Convert actors to array
                  var actor_array = [];
                  for ( key in actors ) {
                     actor_array.push(actors[key]);
                  }

                  // Sort by number of movies
                  actor_array = actor_array.sort(function(a,b) { return a.count - b.count; });
                  
                  // Create a movie black list
                  var blacklist = [];
                  for (var key in movies) {
                     blacklist.push(movies[key]);
                  }
                  
                  self.movie_by_actor( actor_array, blacklist, callback );
               }
            });
         }

         if ( actor_requests <= 0 && movie_requests <= 0) {
            callback({'message':"No movies found.", 'error': 2})
         }
      }

      // Send one query per movie
      for ( var i = 0; i < movie_names.length; i++ ) {
         self.movie_info( movie_names[i], process_movie );
      }
   };

   //
   // PUBLIC INTERFACE
   //

   return {
      
      suggest : self.suggest

   };

};
