this will pull both [rebrand.ly/bookmyshow](http://rebrand.ly/bookmyshow) & [rebrand.ly/paytm-movies](http://rebrand.ly/paytm-movies) into `./store` folder using git

### how to use?

```
sudo apt-get install git node(>= v14)
cd <git_clone_path> && npm i
node report.js bms/ptm date/movie <YYYY-MM-DD>/<movieName>
```

example cmd - `node report.js bms movie Kantara` will generate image table given below

<img src="./store/report.png" />
