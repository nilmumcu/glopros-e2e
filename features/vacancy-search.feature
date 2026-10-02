Feature: Vacancy search
  As a job seeker
  I want to search vacancies by job title
  So that I can find relevant openings

  # Tags: @core = automated, required for a green CI run
  #       @extended = automated, non-blocking (live data or suspected issue)
  #       @suspected = asserts behaviour we expect but the app doesn't show
  #       @manual = documented only; "Observed:" lines record what we saw
  # Each @VS-xx tag matches a test (see README coverage table).

  Background:
    Given I am on the GloPros review app homepage
    And I open "Vacancy search"

  # ---- AUTOMATED: core ----

  # Observed: typing alone triggers the search after ~0.6s; clicking the
  # search icon afterwards sends no second request.
  @core @smoke @VS-01
  Scenario: Search vacancies by main job title (happy path)
    Given location and dates are empty and the distance is the default 100km
    When I enter "Software Engineer" in "Main job title"
    And I submit the search with the search-icon button
    Then the URL keeps "type=vacancies" and "main_job_title[0]" is the job title
    And a non-zero match count is displayed that equals the search API total
    And the top vacancy card shows the top result's title, location and match percentage

  # The search API is stubbed with page.route; the real env is not affected.
  @core @VS-13
  Scenario: Search API failure does not show misleading results
    Given the search API returns HTTP 500
    When I search for "Software Engineer"
    Then no stale cards, match count or "No vacancies" message are shown
    And my job title is kept and the search button is enabled so I can retry

  # ---- AUTOMATED: extended (non-blocking) ----

  # Search is semantic: random strings such as "zzzqqqxxx123" still return
  # hundreds of fuzzy matches, so this uses a phrase verified to return 0.
  @extended @VS-02
  Scenario: Search with a title that matches nothing
    When I enter "Underwater basket weaver" in "Main job title"
    And I submit the search with the search-icon button
    Then the URL keeps "type=vacancies" and "main_job_title[0]" is the job title
    And the search API reports zero matches
    And the "No vacancies match your criteria" empty state is shown
    And no vacancy cards and no match count are rendered

  @extended @VS-11
  Scenario: Results are ordered by match percentage
    When I enter "Software Engineer" in "Main job title"
    And I submit the search with the search-icon button
    Then every card on the first page shows a match percentage
    And the cards are ordered by match percentage, highest first

  @extended @VS-12
  Scenario Outline: Equivalent job titles return the same results
    Given I have searched for "Software Engineer"
    When I search for <variant>
    Then the search API returns the same total, ranking and scores
    And the UI shows that same match count

    Examples:
      | variant                 |
      | "software engineer"     |
      | "SOFTWARE ENGINEER"     |
      | "  Software Engineer  " |

  # Suspected issue: three spaces between the words return 511 matches with
  # lower scores (top result 86% instead of 96%); two spaces are fine.
  @extended @suspected @VS-12
  Scenario: Extra spaces inside the job title return the same results
    Given I have searched for "Software Engineer"
    When I search for "Software   Engineer"
    Then the search API returns the same total, ranking and scores

  # Suspected issue: the results area goes blank with no message. The wording
  # of an error message isn't specified.
  @extended @suspected @VS-13
  Scenario: Search API failure tells the user what happened
    Given the search API returns HTTP 500
    When I search for "Software Engineer"
    Then an error message is shown

  # axe-core, WCAG 2.1 A/AA, critical and serious impact only.
  @extended @VS-14
  Scenario: No new accessibility violations on the results page
    Given I have searched for "Software Engineer"
    When I run an accessibility scan of the page
    Then every critical or serious violation is a known, tracked issue

  # WCAG failures reported by axe: icon-only search button without a name,
  # distance select without a label, form icons without alt text.
  @extended @suspected @VS-14
  Scenario: The search form is accessible
    Given I have searched for "Software Engineer"
    When I run an accessibility scan of the search form
    Then there are no critical or serious violations

  # ---- MANUAL (documented only) ----

  @manual @negative @VS-03
  Scenario: Search with an empty job title
    When I submit the search without entering a job title
    Then I see either all vacancies or a validation message
    And the page does not error
    # Observed: the URL stays "/search/?type=vacancies", no search request is
    # sent and the unfiltered results stay on screen. No validation message.

  @manual @edge @VS-04
  Scenario Outline: Special characters in the title
    When I enter "<title>" in "Main job title"
    And I submit the search
    Then the page renders without an error
    And the URL query param is correctly encoded

    Examples:
      | title                     |
      | C++ / C# Developer        |
      | <script>alert(1)</script> |
      | Ingénieur logiciel        |

  @manual @edge @VS-05
  Scenario: Very long job title
    When I enter a 500-character string in "Main job title"
    And I submit the search
    Then the app handles it gracefully without a server error

  @manual @alternative @VS-06
  Scenario: Submit the search with the Enter key
    When I enter "Software Engineer" in "Main job title"
    And I press Enter
    Then results are shown as with the search button
    # Observed: results already filter while typing (~0.6s after the last
    # key), so Enter sends no extra request; the results are the same.

  @manual @alternative @VS-07
  Scenario Outline: Change the distance filter
    When I enter "Software Engineer" in "Main job title"
    And I set distance to "<distance>"
    And I submit the search
    Then the URL reflects the chosen distance

    Examples:
      | distance |
      | 10km     |
      | 40km     |

  @manual @alternative @VS-08
  Scenario: Deep link to a search URL
    When I open "/search/?type=vacancies" with a job title query param directly
    Then the form is pre-filled and results are shown
    # Observed: the job title is stored as "main_job_title[0]", e.g.
    # /search/?type=vacancies&main_job_title%5B0%5D=Software%20Engineer

  @manual @alternative @VS-09
  Scenario: Browser back returns to the previous search state
    Given I have run a search for "Software Engineer"
    When I navigate back
    Then I am on the previous page without losing state

  @manual @non-functional @VS-10
  Scenario: Mobile viewport
    Given the viewport is 375x667
    When I run the happy-path search
    Then the results and cards are usable without horizontal scroll

  @manual @alternative @VS-15
  Scenario: Filter by start date
    Given my browser is in a timezone east of UTC (e.g. Europe/Amsterdam)
    When I pick 15 October as the start date and search for "Software Engineer"
    Then the search uses 15 October as the start date
    # Observed: the URL stores the date as UTC, startDate=2026-10-14T22:00:00.000Z,
    # while the API request sends "from_date": "2026-10-15".
    # Suspected: the URL value shows the previous day; anything that reads only
    # its date part (e.g. a shared link opened in another timezone) may be off by one.
