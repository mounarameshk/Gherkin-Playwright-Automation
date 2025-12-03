Feature: Transactions page Orders Screen

  Scenario: User login and Transactions page orders screen
    Given the user navigates to the application login page
    When the user fills in email address and password on the sign in page
    When the user clicks on the "Sign In" button
    Then the user should see the Transactions page orders screen with an "Transactions" link

  Scenario: User logout from Transactions page
    Given the user is logged in and on the Transactions page orders screen
    When the user clicks on the "user-avatar" to open the dropdown menu
    When the user clicks on the "Sign Out" button from the dropdown menu
    Then the user should be logged out and redirected to the login page with a "Sign In" button