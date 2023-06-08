
this will download/update both [rebrand.ly/bookmyshow](http://rebrand.ly/bookmyshow) & [rebrand.ly/paytm-movies](http://rebrand.ly/paytm-movies) into `store/dump` folder using git

### how to use?

```
sudo apt-get install git node (>= v14)
cd <folder_path> && npm i
node aggregate.js bms/ptm date/movie <YYYY-MM-DD>/<movieName>
```

example - `node aggregate.js bms date 2023-06-04`

<img src="./store/dump/aggregate.png" />
