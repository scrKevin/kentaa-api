var RequestOptions = require("../request-options");
var APILocation = require("./api-location");

module.exports = class Actions extends APILocation {
  constructor(kentaaApi, parentLocation)
  {
    super(kentaaApi, parentLocation, "actions", "actions");
  }

  /** Returns entire list of Actions. See https://developer.kentaa.nl/kentaa-api/#list-actions
   * @param {Object} [queryParameters] - optional URL parameters (as a {key: value} dictionary) to add to the request.
   * @returns {Array} - The requested list of Actions.
   */
  list(queryParameters)
  {
    return this.getEntirePaginatedList(queryParameters)
  }

  /** Returns an Action. See https://developer.kentaa.nl/kentaa-api/#get-an-action
   * 
   * @param {*} id - The id {Number} or slug {string} of the desired Action.
   * @param {*} [queryParameters] - optional URL parameters (as a {key: value} dictionary) to add to the request.
   * @returns {Object} - The requested Action.
   */
  get(id, queryParameters)
  {
    let requestOptions = new RequestOptions("GET", `${this.apiLocation}/${id}`, queryParameters);
    return this.doRequest(requestOptions);
  }

  /**
   * Create an Action. See https://developer.kentaa.nl/kentaa-api/?shell#create-an-action
   * @param {Number} owner_id - Owner identifier for this action.
   * @param {string} title - Title for the action.
   * @param {string} description - Description for the action.
   * @param {Object} bodyParameters - optional parameters in the POST body (as a {key: value} dictionary) to add to the request.
   */
  create(owner_id, title, description, bodyParameters)
  {
    let body = bodyParameters;
    if (typeof body === 'undefined' && !body) body = {};
    body.owner_id = owner_id;
    body.title = title;
    body.description = description;
    let requestOptions = new RequestOptions("POST", this.apiLocation, null, body);
    return this.doRequest(requestOptions);
  }

  /**
   * Update an Action. See https://developer.kentaa.nl/kentaa-api/?shell#update-an-action
   * @param {Number} action_id - Id of the Action to be updated.
   * @param {Object} bodyParameters - optional parameters in the PATCH body (as a {key: value} dictionary) to add to the request.
   */
  update(action_id, bodyParameters)
  {
    let body = bodyParameters;
    if (typeof body === 'undefined' && !body) body = {};
    let requestOptions = new RequestOptions("PATCH", `${this.apiLocation}/${action_id}`, null, body);
    return this.doRequest(requestOptions);
  }

}