/*============*/
/* App object */
/*============*/
App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',

  // Initialising...
  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {

    var web3Host = "http://127.0.0.1:7545"; // Ganache default rpc address

    // Is there is an injected web3 instance?
    if (typeof web3 !== "undefined") {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // If no injected web3 instance is detected, fallback to Ganache.
      App.web3Provider = new Web3.providers.HttpProvider("http://127.0.0.1:7545");
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Auction.json", function(auction) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.Auction = TruffleContract(auction);
      // Connect provider to interact with contract
      App.contracts.Auction.setProvider(App.web3Provider);

      App.listenForEvents();
      return App.render();

    });
  },

  // Listen for events emitted from the contract
  listenForEvents: function() {
    App.contracts.Auction.deployed().then(function(instance) {
      
      // Highest bid increased event
      instance.HighestBidIncreased({}, {
        fromBlock: 0,
        toBlock: "latest"
      }).watch(function(error, event) {
        if(!error) {
          console.log(event.args.bidder, "has increased the bid to", web3.fromWei(event.args.bidAmount.toNumber(), "ether"), "ether");
          App.render();
        } else {
          console.warn(error);
        }
      });

      // Auction ended event
      instance.AuctionEnded({}, {
        fromBlock: 0,
        toBlock: "latest"
      }).watch(function(error, event) {
        if(!error) {
          $("#status").html("Auction Ended");
          console.log("auction has ended...")

          if(event.args.winningAmount.toNumber() > 0) {
            console.log("winner is", event.args.winner, "with", web3.fromWei(event.args.winningAmount.toNumber(), "ether"), "ether");
            $("#highest-bidder").html("Winning Bidder: ");
          }
          App.render(); 
        } else {
          console.warn(error);
        }
      });

      // Auction cancelled event
      instance.AuctionCancelled({}, {
        fromBlock: 0,
        toBlock: "latest"
      }).watch(function(error, event) {
        if(!error) {
          $("#status").html("Auction Cancelled");
          console.log("auction has been cancelled...");
          App.render();
        } else {
          console.warn(error);
        }
      });

      // Withdrawal event
      instance.Withdrawal({}, {
        fromBlock: 0,
        toBlock: "latest"
      }).watch(function(error, event) {
        if(!error) {
          console.log("withdrawal of", web3.fromWei(event.args.withdrawAmount.toNumber(), "ether"), "ether by", event.args.withdrawAccount);
          App.render();
        } else {
          console.warn(error);
        }
      });
    });
  },

  // Populates the contents of the page with data from the contract
  render: function() {

    var auctionInstance;
    var numberOfBids; // Tracks the bid count for later use

    // Displays the loader
    $("#loader").show();
    $("#content").hide();

    // Loads the current user account
    web3.eth.getCoinbase(function(error, account) {
      if (error === null) {

        App.account = account;
        
        if(App.account === null) {
          $("#loader").html("Please log into your meta mask account");
        } else {
          $("#account-address").html(account);
          $("#loader").html("Loading...");
        }
      }
    });

    // Loads the contract data
    App.contracts.Auction.deployed().then(function(instance) {

      // Allows the auction instance to be referenced for later function calls
      auctionInstance = instance; 

      return auctionInstance.itemName();
    }).then(function(item) {
      // Displays the auction item name
      $("#item-name").html(item);
      return auctionInstance.condition();
    }).then(function(condition) {

      var conditionText;

      // Displays the condition the item is in
      switch(condition.toNumber()) {
        case 0:
          conditionText = "Brand New";
          break;
        case 1:
          conditionText = "Like New";
          break;
        case 2:
          conditionText = "Very Good";
          break;
        case 3:
          conditionText = "Good";
          break;
        default:
          conditionText = "Acceptable";
      }

      $("#condition").html(conditionText);
      return auctionInstance.startPrice();
    }).then(function(startPrice) {
      // Displays the start price (minimum bid price)
      $("#current-price").html('<i class="fab fa-ethereum"></i> ' + web3.fromWei(startPrice.toNumber(), "ether") + " ether");
      return auctionInstance.buyPrice();
    }).then(function(buyPrice) {
      // Displays the buy price ("buy it now" price)
      $("#buy-price").html('<i class="fab fa-ethereum"></i> ' + web3.fromWei(buyPrice.toNumber(), "ether") + " ether");
      return auctionInstance.bidCount();
    }).then(function(bidCount) {

      numberOfBids = bidCount.toNumber();

      // Displays the bid count
      $("#bid-count").html(numberOfBids);
      numberOfBids === 1 ? $("#bid-count").html("[ " + numberOfBids + " bid ]") : $("#bid-count").html("[ " + numberOfBids + " bids ]");
      return auctionInstance.highestBidder();
    }).then(function(highestBidder) {
      // Displays the current highest bidder
      $("#highest-bidder-address").html(highestBidder);
      return auctionInstance.highestBid();
    }).then(function(highestBid) {
      // If a bid exists then the start price changes to the current bid price
      if(numberOfBids > 0) {
        $("#current-bid").html("Current Bid: ");
        $("#current-price").html('<i class="fab fa-ethereum"></i> ' + web3.fromWei(highestBid.toNumber(), "ether") + " ether"); 
      }
      return auctionInstance.owner();
    }).then(function(owner) {
      // Updates interface depending if user is the admin (seller)
      if(App.account === owner) {
        $("#bidding-options").hide();
        $("#auction-admin").show();
        $("#account-address").html(App.account + " (Admin)");
        $("#main").css("padding-bottom", "15px");
      } else {
        // For normal users (bidders) 
        $("#bidding-options").show();
        $("#auction-admin").hide(); 
      }
      return auctionInstance.ended();
    }).then(function(ended) {
      // Check if the auction has ended
      if(ended) {
        $("#end-auction-btn").prop("disabled", true);
        App.endAuction();
      }
      // Checks for any pending withdrawals for current user
      try {
        return auctionInstance.pendingWithdrawals(App.account); 
      } catch (error) {
        console.log("please log into your meta mask account");
      }
    }).then(function(amount) {
      // Only runs when user is logged into their meta mask account
      if(amount !== undefined) {
        if(amount > 0) {
          console.log("pending withdraw amount: " + web3.fromWei(amount, "ether"), "ether");
          $(".withdraw-funds-btn").prop("disabled", false);
        } else {
          $(".withdraw-funds-btn").prop("disabled", true);
        }
        $("#loader").hide();
        $("#content").show();
      }
    }).catch(function(error) {
      console.warn(error);
    });
  },

  // Updates the auction timer
  updateTimer: function() {
    App.contracts.Auction.deployed().then(function(instance) {
      return instance.auctionEndTime();
    }).then(function(endTime) {

      var timeLeft = parseInt(endTime.sub(new Date().getTime() / 1000));

      // Converting time to days, hours, minutes and seconds
      var d = Math.floor(timeLeft / (24*3600));
      var h = Math.floor((timeLeft % (24*3600)) / 3600);
      var m = Math.floor((timeLeft % 3600) / 60);
      var s = Math.floor(timeLeft % 3600 % 60);

      // Displays the time remaining
      if (timeLeft <= 0) {
        // Update interface to indicate auction is over
        console.log("auction time over");
        $("#end-auction-btn").prop("disabled", false);
        $("#status").html("Auction Over");
        App.endAuction();
      } else {
        // Pads out the digits (treats anything above 100 days as 99 days)
        $("#day").html(("0" + d).slice(-2));
        $("#hour").html(("0" + h).slice(-2));
        $("#minute").html(("0" + m).slice(-2));
        $("#second").html(("0" + s).slice(-2));
      } 
    }).catch(function(error) {
      console.warn(error);
    });
  },

  // Updates interface when switching accounts
  updateAccount: function() {
    web3.eth.getCoinbase(function(error, account) {
      if (error === null) {
        if(App.account !== account) {
          console.log("account has switched to", account);
          App.render();
        }
      }
    });  
  },

  // End auction - updates interface to reflect auction is over
  endAuction: function() {
    clearInterval(timerInterval);
    $("#day").html("00");
    $("#hour").html("00");
    $("#minute").html("00");
    $("#second").html("00");
    $("#bid-amount").val("");
    $("#bid-amount").prop("disabled", true);
    $("#place-bid-btn").prop("disabled", true);
    $("#buy-now-btn").prop("disabled", true);
    $("#cancel-auction-btn").prop("disabled", true);
  },

  // Manually triggered ending of an auction
  manualEndAuction: function() {
    App.contracts.Auction.deployed().then(function(instance) {
      return instance.endAuction({from: App.account});
    }).then(function(result) {
      App.endAuction();
      $("#content").hide();
      $("#loader").show();
    }).catch(function(error) {
      console.warn(error);
    });
  },

  // Bidding for the item
  placeBid: function() {
    var auctionInstance;
    var bidAmount = parseFloat($("#bid-amount").val());
    App.contracts.Auction.deployed().then(function(instance) {
      auctionInstance = instance;
      return auctionInstance.highestBid();
    }).then(function(highestBid) {
      // Check if the bid amount is higher than the highest bid
      if(bidAmount > web3.fromWei(highestBid.toNumber(), "ether")) {
        return auctionInstance.placeBid({ from: App.account, value: web3.toWei($("#bid-amount").val(), "ether")});
      } else {
        modal.css("display", "block");
      }
    }).then(function(result) {
      if(result !== undefined) {
        $("#bid-amount").val("");  // Clears the bid amount input field
        $("#content").hide();
        $("#loader").show();
      }
    }).catch(function(error) {
      console.warn(error);
    });
  },

  // Buying the item
  buyNow: function() {
    var auctionInstance;
    App.contracts.Auction.deployed().then(function(instance) {
      auctionInstance = instance;
      return instance.buyPrice();
    }).then(function(buyPrice, error) {
      return auctionInstance.placeBid({from: App.account, value: buyPrice});
    }).catch(function(error) {
      console.warn(error);
    });
  },

  // Cancelling the auction
  cancelAuction: function() {
    App.contracts.Auction.deployed().then(function(instance) {
      return instance.cancelAuction({ from: App.account });
    }).then(function(result) {
      App.endAuction();
      $("#content").hide();
      $("#loader").show();
    }).catch(function(error) {
      console.warn(error);
    });
  },

  // Withdrawing funds
  withdraw: function() {
    App.contracts.Auction.deployed().then(function(instance) {
      return instance.withdraw({from: App.account, gas: 200000});
    }).then(function(result) {
      $("#content").hide();
      $("#loader").show();
    }).catch(function(error) {
      console.warn(error);
    });   
  }
};

/*======================*/
/* Initialising the app */
/*======================*/

// Global variables for monitoring timer and account changes
var timerInterval;
var accountInterval;

// Wait for the page to load first before executing
$(function() {
  $(window).on("load", function() {
    App.init();
    timerInterval = setInterval(App.updateTimer, 1000); // Polls the time
    accountInterval = setInterval(App.updateAccount, 100);  // Polls user account
  });
});

/*==========================*/
/* Modal window interaction */
/*==========================*/
var modal = $("#low-bid-modal");
var span = $(".close")[0];

// When the user clicks on (x)
span.onclick = function() {
    modal.css("display", "none");
}

// When the user clicks anywhere outside of the modal window
window.onclick = function(event) {
  var target =  $(event.target);
    if (target.is(modal)) {
      modal.css("display", "none");
    }
}  