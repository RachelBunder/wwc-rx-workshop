function ExerciseRunner() {
    this.started = false;
}

ExerciseRunner.prototype.stopTweetStream = function() {
    this.tweetSubscription.dispose();
    console.log('Tweet stream stopped.');
}

ExerciseRunner.prototype.multiplierChanged = function() {
    this.tweetStream.schedulerProvider.timeMultiplier = this.timeMultiplier.value;
    this.multiplierSpan.innerHTML = this.timeMultiplier.value;
}

ExerciseRunner.prototype.setupEventHandlers = function() {
    this.timeMultiplier = document.getElementById('timeMultiplier');
    this.multiplierSpan = document.getElementById('multiplierValue');
    this.exerciseSource = document.getElementById('exerciseSource');

    this.timeMultiplier.onchange = this.multiplierChanged.bind(this);

    this.startStopButton = document.getElementById('startStopButton');
    this.startStopButton.onclick = this.startStop.bind(this);
}

ExerciseRunner.prototype.createTweetStream = function() {
    var fileInput = document.getElementById('files');
    var file = fileInput.files[0];
    var filereader = new FileReader();
    var self = this;

    filereader.onload = function (e) {
        var text = filereader.result;

        self.tweetStream = new TwitterStream(text);
        self.tweetSubscription = new Rx.CompositeDisposable();
        self.tweetSubscription.add(Rx.Disposable.create(self.tweetStream.stop.bind(self.tweetStream)));

        self.runTweetStream();
    };

    filereader.readAsText(file);
}

ExerciseRunner.prototype.startStop = function () {
    // This is exactly the kind of junk code Rx is better at

    if (!this.started)
        this.createTweetStream();
    else
        this.stopTweetStream();

    this.started = !this.started;
    this.startStopButton.innerHTML = this.started ? 'Stop' : 'Start';
}

ExerciseRunner.prototype.runTweetStream = function () {
    this.tweetSubscription.add(this.tweetStream.schedulerProvider.now.subscribe(this.updateTime.bind(this)));

    this.multiplierChanged();
    this.tweetStream.start();
    var scheduler = this.scheduler = this.tweetStream.schedulerProvider.scheduler;

    var useSolution = this.exerciseSource.selectedIndex === 1;
    var exerciseImplementations = useSolution ? new ExerciseSolutions() : new Exercises();

    var tweetsPerMinute = exerciseImplementations.tweetsPerMinute(this.tweetStream.stream, scheduler);
    var latestTweetDetails = exerciseImplementations.recentActivity(this.tweetStream.stream, scheduler);
    var interestingTweets = exerciseImplementations.interestingTweets(this.tweetStream.stream, scheduler);

    this.tweetSubscription.add(tweetsPerMinute.subscribe(this.updateTweetsPerMinute.bind(this)));

    this.tweetSubscription.add(latestTweetDetails.subscribe(this.updateRecentActivity.bind(this)));

    var lastMinuteInterestingTweets = interestingTweets.bufferWithTime(60000, 5000, scheduler);
    this.tweetSubscription.add(lastMinuteInterestingTweets.subscribe(this.updateInterestingTweets.bind(this)));

    scheduler.advanceBy(60000);

    console.log('Tweet stream started.');
}

ExerciseRunner.prototype.updateTweetsPerMinute = function (tpm) {
    this.recentActivity.tweetsPerMinute = {
        timestamp: moment(this.scheduler.now()).format(timestampFormat),
        count: tpm
    };
    this.recentActivityRactive.update();
}

ExerciseRunner.prototype.updateRecentActivity = function (tweet) {
    this.recentActivity.recentTweet = tweet;
    this.recentActivityRactive.update();
}

ExerciseRunner.prototype.updateTime = function (time) {
    this.recentActivity.currentTime = moment(time).format(timestampFormat);
    this.recentActivityRactive.update();
}

ExerciseRunner.prototype.updateInterestingTweets = function (tweets) {
    this.interestingTweets.tweets = tweets;
    this.interestingTweetsRactive.update();
}

ExerciseRunner.prototype.run = function () {
    this.setupEventHandlers();

    this.recentActivity = { };
    this.recentActivityRactive = new Ractive(
        {
            el: '#recentActivityContainer',
            template: '#recentActivityTemplate',
            data: this.recentActivity
        });

    this.interestingTweets = {};
    this.interestingTweetsRactive = new Ractive(
        {
            el: '#interestingTweetsContainer',
            template: '#interestingTweetsTemplate',
            data: this.interestingTweets
        });
}

timestampFormat = 'YYYY-MM-DD HH:mm:ss';
var exerciseRunner = new ExerciseRunner();
window.onload = exerciseRunner.run.bind(exerciseRunner);