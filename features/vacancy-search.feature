Feature: Vacancy search
  As a job seeker
  I want to search vacancies by job title
  So that I can find relevant openings

  Background:
    Given I am on the GloPros review app homepage
    And I open "Vacancy search"

  # ---- AUTOMATED (tests/vacancy-search.spec.ts, linked by the @VS-xx tag) ----
  @automated @smoke @VS-01
  Scenario: Search vacancies by main job title (happy path)
    When I enter "Software Engineer" in "Main job title"
    And I leave location and dates empty with the default distance of 100km
    And I submit the search with the search-icon button
    Then the URL keeps "type=vacancies" and contains the job title query param
    And a non-zero match count is displayed that equals the search API total
    And at least one vacancy card shows title, location and match percentage

  # Search is semantic: random strings such as "zzzqqqxxx123" still return
  # hundreds of fuzzy matches, so this uses a phrase verified to return 0.
  @automated @negative @VS-02
  Scenario: Search with a title that matches nothing
    When I enter "Underwater basket weaver" in "Main job title"
    And I submit the search with the search-icon button
    Then the URL keeps "type=vacancies" and contains the job title query param
    And the search API reports zero matches
    And the "No vacancies match your criteria" empty state is shown
    And no vacancy cards and no match count are rendered

  # ---- DOCUMENTED ONLY (not automated) ----
  @manual @negative @VS-03
  Scenario: Search with an empty job title
    When I submit the search without entering a job title
    Then I see either all vacancies or a validation message
    And the page does not error

  @manual @edge @VS-04
  Scenario Outline: Special characters and whitespace in the title
    When I enter "<title>" in "Main job title"
    And I submit the search
    Then the page renders without an error
    And the URL query param is correctly encoded

    Examples:
      | title                     |
      | "  Software Engineer  "   |
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

  @manual @alternative @VS-07
  Scenario Outline: Change the distance filter
    When I enter "Software Engineer" in "Main job title"
    And I set distance to "<distance>"
    And I submit the search
    Then the URL reflects the chosen distance

    Examples:
      | distance |
      | 10km     |
      | 50km     |

  @manual @alternative @VS-08
  Scenario: Deep link to a search URL
    When I open "/search/?type=vacancies" with a job title query param directly
    Then the form is pre-filled and results are shown

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
