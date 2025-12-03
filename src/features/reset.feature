Feature: Forgot Credentials

  Scenario: User reset email address
    Given the user navigates to the application login page
    When the user clicks on the "Forgot email or password?" link on the sign in page
    When the user clicks on "I forgot my email address" radio button
    When the user clicks on Next button
    Then the user confirms message "We've got you covered" getting displayed