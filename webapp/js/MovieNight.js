/**
 * This is an example application to show off a forked version of
 * the facebook connect javascript library. The new version of the
 * library allows external data sources to be accessed through the 
 * graph API, by prefixing a namespace in the graph path.
 * 
 * This client side functionality is coupled with a server-side wrapper
 * for the neo4j graph database, that exposes the neo4j database in a fashion
 * similar to facebook. For this example the backend we use is loaded with 
 * an example dataset from IMDB.
 * 
 * The point of this is that facebook has built an excellent client-side javascript
 * API for graphs, with built in support for OpenID authentication. It also enables
 * our javascript application to connect to any URL by circumventing the same origin
 * policy.
 *
 * Note that OpenID currently only is enabled against Facebook.
 * 
 * TL;DR: To see the extended facebook connect in action, see the bottom of this file, and the 
 * movie suggester class in SuggestionEngine.js.
 *
 * @author Jacob Hansson <jacob@voltvoodoo.com>
 */

/**
 * Movie night entry point class.
 * @author Jacob Hansson <jacob@voltvoodoo.com>
 */
var MovieNight = function() {

   var self = this;

   // 
   // PRIVATE
   //

   self.logged_in = false;
   self.suggester = new SuggestionEngine();
   self.friend_list = $("#friendlist");

   /**
    * Load all friends from facebook.
    */
   self.load_friends = function() {
      
      FB.api('/me/friends', function(response) {
         
         self.friends = response.data;

         // Load friends into UI
         self.friend_list.empty();
         for ( var i = 0; i < self.friends.length; i ++ ) {
            self.add_friend( self.friends[i] );
         }

      });
   };

   /**
    * Suggest a movie to watch
    * @param {object} the friend to watch movie with.
    */
   self.suggest_movie = function(friend) {
      if ( self.logged_in ) {
         $("#movie-suggestions-box h2").html("Loading ...");
         $("#movie-suggestions-box p").html("");
            
         // Get movies this friend likes    
         FB.api("fb:/" + friend.id + "/movies", function(result) {

            // Create array of movie names
            var movies = [];
            for ( var i = 0; i < result.data.length; i ++ ) {
               movies.push(result.data[i].name );
            }

            if ( movies.length > 0 ) {
               // Ask IMDB about these movies
               self.suggester.suggest( movies, function( result ) {
                  if ( ! result.error ) {
                      $("#movie-suggestions-box h2").html("For a movie night with " + friend.name + ":");
                      $("#movie-suggestions-box p").html("You guys should totally watch <em>" + result.title + "</em>!<br />It stars " + result.star.name + ", " + friend.first_name + "'s favorite actor.");
                  } else if ( result.error === 2 ) {
                      $("#movie-suggestions-box h2").html("No movies found :(");
                      $("#movie-suggestions-box p").html("Given the movies that " + friend.name + " likes, there were no other movies that we could find that would be good for a sweet movie night. Maybe you guys should go bowling instead?");
                  } else {
                      $("#movie-suggestions-box h2").html("Unknown error");
                      $("#movie-suggestions-box p").html("An unknown error occurred that stopped us from finding a good movie :/.");
                  }
               });
            } else {
               $("#movie-suggestions-box h2").html(friend.name + " has no movies listed.");
            }
         });

      } else {
         alert("You are not logged in.");
      }
   };

   /**
    * Add a friend to the UI list.
    * @param {object} the friend
    */
   self.add_friend = function(friend) {
      var li = $("<li></li>");
      var button = $("<a href='#'>" + friend.name + "</a>");
      button.click(function (e) {
         self.suggest_movie( friend );
         e.preventDefault();
      });

      // Add to UI
      li.append(button);
      self.friend_list.append(li);
   };

   // 
   // INITIATE
   //

   FB.login(function(response) {
      if (response.session) {
         self.logged_in = true;
         self.load_friends();
      } else {
        alert("Failed to log into facebook.");
      }
   });

   //
   // PUBLIC INTERFACE
   //
   
   return {
      suggest_movie : self.suggest_movie
   };

};

//
// INIT APPLICATION
//

$(document).ready(function() {
   
   try {
      FB.init({
         appId  : '', // <- ADD FACEBOOK APPLICATION ID HERE
         status : true, // check login status
         cookie : true, // enable cookies to allow the server to access the session
         xfbml  : true, // parse XFBML

         // This is how external data sources are defined in this forked
         // version of facebook connect. Each property in this object defines
         // a namespace and a url to map that namespace to. 
         //
         // By defining, something like:
         //
         //    external_domains : { 
         //       mydata : "http://mydata.com/" 
         //    }
         //
         // where mydata.com is a server that responds according to the facebook API standard, you will 
         // be able to access that server like so:
         //
         // FB.api("mydata:/path/to/data/in/graph", function(data) {
         //    // Data is available here :)  
         // });
         external_domains : {
            imdb : 'http://localhost:4567/'
         }

      });
         
      var main = new MovieNight();

   } catch(e) {
      alert("Caught Error: " + e);
   }
});
