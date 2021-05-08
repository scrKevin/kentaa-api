var helpers = require('./lib/helpers');
var QueuedRequest = require('./lib/queued-request');
var RequestOptions = require('./lib/request-options');

var Actions = require('./lib/api/actions');

const REQUEST_LIMIT_PER_MINUTE = 100;
const REQUEST_LIMIT_PER_HOUR = 500;


// Rate limiting
// The number of requests is limited to 100 per minute and 500 per hour per API key. When the rate limit is exceeded, the status code 429 will be returned.

// The following headers are included in the response:

// X-RateLimit-Limit-Hour - the maximum number of requests per hour
// X-RateLimit-Remaining-Hour - number of requests remaining per hour
// X-RateLimit-Limit-Minute - the maximum number of requests per minute
// X-RateLimit-Remaining-Minute - number of requests remaining per minute

// counters are reset on the 0th minute of every hour and the 0th second of every minute

module.exports = class KentaaApi {

  constructor(apiKey) {
    this.apiKey = apiKey;
    this.remainingRequestThisMinute = REQUEST_LIMIT_PER_MINUTE;
    this.remainingRequestThisHour = REQUEST_LIMIT_PER_HOUR;
    this.actions = new Actions(this);

    // queue our requests so we can check if we are not exeeding the api rate limits
    this.queuedRequests = [];

    
    // start the automatic rate limit reset functions. These will run async.
    this.resetRequestsThisMinute();
    this.resetRequestsThisHour();
  }
  
  //methods

  // reset the request limit every minute and dequeue requests if there are any in the request queue.
  async resetRequestsThisMinute()
  {
    while (true) // loop forever
    {
      this.remainingRequestThisMinute = REQUEST_LIMIT_PER_MINUTE;
      //console.log(`Resetting remaining requests this minute: ${this.remainingRequestThisMinute}`);
      this.dequeueNextRequest();
      await helpers.waitUntilNextMinute();
    }
  }

  // reset the request limit every hour and dequeue requests if there are any in the request queue.
  async resetRequestsThisHour()
  {
    while (true) // loop forever
    {
      this.remainingRequestThisHour = REQUEST_LIMIT_PER_HOUR;
      //console.log(`Resetting remaining requests this hour: ${this.remainingRequestThisHour}`);
      this.dequeueNextRequest();
      await helpers.waitUntilNextHour();
    }
  }

  // in the response header coming from the Kentaa api, the remaining requests are given. The queuedrequest object can set the value with these methods.
  setRemainingRequestThisMinute(newValue)
  {
    this.remainingRequestThisMinute = newValue;
  }

  setRemainingRequestThisHour(newValue)
  {
    this.remainingRequestThisHour = newValue;
  }

  // if this method is called, a queued request will be executed if the rate limit is not being exceeded. If no requests are queued, nothing will happen.
  dequeueNextRequest()
  {
    if (this.queuedRequests.length > 0 && this.remainingRequestThisMinute > 0 && this.remainingRequestThisHour > 0)
    {
      this.remainingRequestThisHour--;
      this.remainingRequestThisMinute--;
      let queuedRequest = this.queuedRequests.shift();
      queuedRequest.dequeue();
    }
  }

  // list operations are paginated to 100 results per page (default is 25). We need to make multiple requests to fill our entire list.
  // this method will check the totalpages, create additional requests accordingly and will resolve to the entire concatenated paginated list.
  
  /** Returns the entire paginated list of specified objects
   * @param {string} apiLocation - The URL location as specified by the Kentaa API docs. IE. 'actions' for Action objects.
   * @param {string} nameOfTargetList - The key name of the target list in the response. IE. 'donation_forms' for Donation forms objects.
   * @param {Object} [optionalParameters] - Optional URL parameters.
   */
  async getEntirePaginatedList(apiLocation, nameOfTargetList, optionalParameters)
  {
    if ( typeof optionalParameters === 'undefined' && !optionalParameters ) optionalParameters = {};
    let resultList = [];
    optionalParameters["per_page"] = 100;
    optionalParameters["page"] = 1;
    let requestOptions = new RequestOptions("GET", apiLocation, { ... optionalParameters});
    let listOfFirstPage = await this.doRequest(requestOptions);
    let totalPages = listOfFirstPage['total_pages'];
    if(totalPages == 1)
    {
      // total pages == 1, so returning the list from the first page will suffice.
      return listOfFirstPage[nameOfTargetList];
    }
    else if (totalPages > 1)
    {
      // total pages > 1, so additional requests will have to be made. The resulting lists per page will be concatenated to the original list.
      resultList = listOfFirstPage[nameOfTargetList];
      for (var page = 2; page <= totalPages; page++)
      {
        optionalParameters["page"] = page;
        let requestOptions = new RequestOptions("GET", apiLocation, { ... optionalParameters});
        let listOfThisPage = await this.doRequest(requestOptions);
        resultList = resultList.concat(listOfThisPage[nameOfTargetList]);
      }
      return resultList;
    }
  }

  // do a  request on the Kentaa api. Returns a promise that will resolve once the response of the request is received.
  // if the api rate limit is exceeded, the promise will be resolved once the rate limits are reset (every minute or every hour).
  
  /** Do a request on the Kentaa API.
   * @param {RequestOptions} requestOptions - The request options object.
   */
  doRequest(requestOptions)
  {
    let queuedRequest = new QueuedRequest(requestOptions, this);
    this.queuedRequests.push(queuedRequest);
    // check if we can execute this new request in the next iteration of the event loop.
    setImmediate(() => {
      this.dequeueNextRequest();
    });

    // return the promise that will be resolved when this request is dequeued.
    return queuedRequest.promise;
  }
}