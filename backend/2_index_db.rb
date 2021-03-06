Neo4j.migration 2, "Index DB" do
  up do

    puts "Migration 2, Index DB on #{Lucene::Config[:storage_path]}"

    Neo4j::Transaction.run do
      puts "Creating lucene index ..."
      Actor.index :name, :tokenized => true
      Movie.index :title, :tokenized => true
      start = Time.new
      Actor.update_index
      Movie.update_index
      puts "Index speed #{Time.new - start} sec"
    end
    # only possible to access and query the index after the transaction commits
  end

  down do
    puts "removing lucene index"
    Actor.remove_index :name
    Movie.remove_index :title
    # Actor.update_index # maybe nicer way of deleting indexes - hmm, does it work ?
    require 'fileutils'
    FileUtils.rm_rf Lucene::Config[:storage_path] # quick and dirty way of killing the lucene index
  end
end
