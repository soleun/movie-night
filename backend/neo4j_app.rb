#!/usr/bin/env ruby

require 'rubygems'
require 'sinatra/base'
require 'json'
require 'neo4j'

class Neo4jTransactionMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    Neo4j::Transaction.new
    begin
      @app.call(env)
    rescue 
      Neo4j::Transaction.failure
    ensure
      Neo4j::Transaction.finish
    end
  end
  
end

# we have to configure these before the model is loaded
Lucene::Config[:store_on_file] = true
Lucene::Config[:storage_path] = "tmp/lucene"

require "model"
require "neo4j/extensions/reindexer"

# Load Migrations
require '1_create_neo_db'
require '2_index_db'

class NeoApp < Sinatra::Base
  use Neo4jTransactionMiddleware

  get '/' do 
    content_type 'text/javascript'
    # just for debugging purpose, will be rather big JSON ...
    all_nodes = []
    Neo4j.all_nodes{|node| all_nodes << node.props}
    JSON.pretty_generate(all_nodes)
  end

  get '/search' do
    content_type 'text/javascript'
    q = params[:q]
    type = params[:type]
    halt 400 unless q && type
    result = case type
      when 'actor'
        Actor.find(to_lucene(:name, q))
      when 'movie'
        Movie.find(to_lucene(:title, q))
      else
        []
    end
    json = JSON.pretty_generate(result.map{|node| external_props_for(node)})
    json = callback_wrapper(json, params[:callback])
    json
  end

  get '/:id' do # show a node
    content_type 'text/javascript'
    node = node_by_id(params[:id])
    props = external_props_for(node)
    props.merge! metadata_for(node) if params[:metadata] == "1"
    json = JSON.pretty_generate(props)
    json = callback_wrapper(json, params[:callback])
    json
  end
  
  get '/:id/:relation' do # show a relationship
    content_type 'text/javascript'
    node = node_by_id(params[:id])
    data = []
    [ :acted_in, :actors ].each do |relationship|
      if params[:relation] == relationship.to_s and node.respond_to? relationship
        data = node.send(relationship)
      end
    end
    data = data.map{|node| node_data(node)}
    json = JSON.pretty_generate({:data => data})
    json = callback_wrapper(json, params[:callback])
    json
  end

  def to_lucene(field, q)
    q.split(',').collect{|t| "#{field.to_s}:#{t.strip}"}.join(" AND ")
  end

  def node_by_id(id)
    node = Neo4j.load_node(id) if id =~ /^(\d+)$/
    halt 404 if node.nil?
    node
  end

  # Show only the most basic node info when listing relationships
  def node_data(node)
    data = { :id => node.neo_id }
    [ :name, :title ].each do |property|
      data.merge!({ property => node[property] }) unless node[property].nil?
    end
    data
  end
  
  def external_props_for(node)
    ext_props = node.props.delete_if{|key, value| key =~ /^_/}
    ext_props[:id] = node.neo_id
    ext_props
  end

  # TODO: Since we echo the callback right back we should js-escape it
  def callback_wrapper(json, callback)
    callback ? "#{callback}(#{json});" : json
  end
  
  def metadata_for(node)
    if node.kind_of? Actor 
      connections = url_for(node, "acted_in")
    elsif node.kind_of? Movie
      connections = url_for(node, "actors")
    end
    metadata = { :metadata => { :connections => connections }, :type => node.class.name.downcase }
  end  
  
  def url_for(node, rel = nil)
    if (request.scheme == 'http' && request.port == 80 ||
        request.scheme == 'https' && request.port == 443)
      port = ""
    else
      port = ":#{request.port}"
    end
    base = "#{request.scheme}://#{request.host}#{port}#{request.script_name}"
    if rel.nil?
      "#{base}/#{node.neo_id}"
    else
      "#{base}/#{node.neo_id}/#{rel}"
    end
  end
  
end

NeoApp.run!
