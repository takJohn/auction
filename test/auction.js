var Auction = artifacts.require("./Auction.sol");

contract("Auction", function(accounts) {

	/*======================================================================================================
		Alice (accounts[0]) is selling a Lamborghini Aventador that's still "like new" -
		she sets the 'start price' at 1 ether and the 'buy price' at 50 ether, which is a real bargain!
		Bob (accounts[1]), Charlie (accounts[2]) and David (accounts[3]) are all vying for the same Lambo...
	========================================================================================================*/

	var auctionInstance;
	var auctionItemName = "Lamborghini Aventador";
	var auctionCondition = 1; // The condition is an enum where 1 = LikeNew
	var auctionDuration = 240; // Duration is in minutes
	var auctionStartPrice =  web3.toWei(1, "ether");
	var auctionBuyPrice =  web3.toWei(50, "ether")

	/*================================*/
	/* Peforming initialisation tests */
	/*================================*/
	it("Alice's auction contract is correctly initialised", function() {
		return Auction.deployed().then(function(instance) {
			auctionInstance = instance;
			return auctionInstance.itemName();
		}).then(function(itemName) {
			assert.equal(itemName, auctionItemName, "item name check failed");
			return auctionInstance.condition();
		}).then(function(condition) {
			assert.equal(condition, auctionCondition, "condition check failed");
			return auctionInstance.auctionEndTime();
		}).then(function(auctionEndTime) {
			var endTimeTest = parseInt((auctionDuration*60) + (new Date().getTime() / 1000));
			expect(parseInt(auctionEndTime)).to.be.closeTo(endTimeTest, 1, "auction end time check failed");
			return auctionInstance.startPrice();		
		}).then(function(startPrice) {
			assert.equal(startPrice, auctionStartPrice, "start price check failed");
			return auctionInstance.buyPrice();	
		}).then(function(buyPrice) {
			assert.equal(buyPrice, auctionBuyPrice, "buy price check failed");
			return auctionInstance.bidCount();
		}).then(function(bidCount) {
			assert.equal(bidCount, 0, "bid count check failed");
			return auctionInstance.highestBidder();
		}).then(function(highestBidder) {
			assert.equal(highestBidder, 0x0000000000000000000000000000000000000000, "highest bidder check failed");
			return auctionInstance.highestBid();	
		}).then(function(highestBid) {
			assert.equal(highestBid, 0, "highest bid check failed");
			return auctionInstance.ended();	
		}).then(function(ended) {
			assert.equal(ended, false, "ended check failed");
			return auctionInstance.pendingWithdrawals(0);	
		}).then(function(pendingWithdrawals) {
			assert.equal(pendingWithdrawals[0], undefined, "pending withdrawals check failed");
		});
	});

	/*======================================*/
	/* Peforming contract interaction tests */
	/*======================================*/
	it("Bob places a bid of 5 ether", function() {
	  	return Auction.deployed().then(function(instance) {
	  		auctionInstance = instance;
	      	return auctionInstance.placeBid({ from: accounts[1], value: web3.toWei(5, "ether")});
	    }).then(function(receipt) {
	      	assert.equal(receipt.logs.length, 1, "emit event check failed");
	      	assert.equal(receipt.logs[0].event, "HighestBidIncreased", "highest bid increased event check failed");
	     	assert.equal(receipt.logs[0].args.bidder, accounts[1], "bidder address check failed");
	     	assert.equal(receipt.logs[0].args.bidAmount, web3.toWei(5, "ether"), "bid amount check failed");
	     	return auctionInstance.highestBidder();
	    }).then(function(highestBidder) {
	    	assert.equal(highestBidder, accounts[1], "highest bidder updated to Bob check failed");
	    	return auctionInstance.highestBid();
	    }).then(function(highestBid) {
	    	assert.equal(highestBid, web3.toWei(5, "ether"), "highest bid updated to 5 ether check failed");
	    });
	});

	it("Charlie is NOT able to place a bid below the current bid price", function() {
	  	return Auction.deployed().then(function(instance) {
	      	return instance.placeBid({ from: accounts[2], value: web3.toWei(1, "ether")});
	    }).then(assert.fail).catch(function(error) {
	    	assert(error.message.indexOf('revert') >= 0, "low bid check failed");
	    });
	});

	it("Alice is NOT able to place a bid on her own item", function() {
	  	return Auction.deployed().then(function(instance) {
	      	return instance.placeBid({ from: accounts[0], value: web3.toWei(10, "ether")});
	    }).then(assert.fail).catch(function(error) {
	    	assert(error.message.indexOf('revert') >= 0, "seller placing a bid check failed");
	    });
	});

	it("Bob is still the highest bidder with a bid of 5 ether", function() {
		return Auction.deployed().then(function(instance) {
			auctionInstance = instance;
	     	return auctionInstance.highestBidder();
	    }).then(function(highestBidder) {
	    	assert.equal(highestBidder, accounts[1], "highest bidder is still Bob check failed");
	    	return auctionInstance.highestBid();
	    }).then(function(highestBid) {
	    	assert.equal(highestBid, web3.toWei(5, "ether"), "highest bid remains at 5 ether check failed");
	    });
	});

	it("No one is able to withdraw any ether", function() {
		return Auction.deployed().then(function(instance) {
			auctionInstance = instance;
			return auctionInstance.withdraw({from: accounts[0]});
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[0], "withdraw account for Alice check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, 0, "withdraw amount for Alice check failed");
			return auctionInstance.withdraw({from: accounts[1]});
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[1], "withdraw account for Bob check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, 0, "withdraw amount for Bob check failed");
			return auctionInstance.withdraw({from: accounts[2]});
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[2], "withdraw account for Charlie check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, 0, "withdraw amount for Charlie check failed");
			return auctionInstance.withdraw({from: accounts[3]});
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[3], "withdraw account for David check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, 0, "withdraw amount for David check failed");
		});
	});

	it("David places a bid of 10 ether and becomes the new highest bidder", function() {
	  	return Auction.deployed().then(function(instance) {
	  		auctionInstance = instance;
	      	return auctionInstance.placeBid({ from: accounts[3], value: web3.toWei(10, "ether")});
	    }).then(function(receipt) {
	      	assert.equal(receipt.logs.length, 1, "emit event check failed");
	      	assert.equal(receipt.logs[0].event, "HighestBidIncreased", "highest bid increased event check failed");
	     	assert.equal(receipt.logs[0].args.bidder, accounts[3], "bidder address check failed");
	     	assert.equal(receipt.logs[0].args.bidAmount, web3.toWei(10, "ether"), "bid amount check failed");
	     	return auctionInstance.highestBidder();
	    }).then(function(highestBidder) {
	    	assert.equal(highestBidder, accounts[3], "highest bidder updated to David check failed");
	    	return auctionInstance.highestBid();
	    }).then(function(highestBid) {
	    	assert.equal(highestBid, web3.toWei(10, "ether"), "highest bid updated to 10 ether check failed");
	    });
	});

	it("Bob withdraws 5 ether before placing another bid of 20 ether", function() {
	  	return Auction.deployed().then(function(instance) {
	  		auctionInstance = instance;
	  		return auctionInstance.withdraw({from: accounts[1]});
	  	}).then(function(withdraw) {
	  		assert.equal(withdraw.logs[0].args.withdrawAmount, web3.toWei(5, "ether"), "withdraw for Bob's 5 unlocked ether check failed");
	      	return auctionInstance.placeBid({ from: accounts[1], value: web3.toWei(20, "ether")});
	    }).then(function(receipt) {
	      	assert.equal(receipt.logs.length, 1, "emit event check failed");
	      	assert.equal(receipt.logs[0].event, "HighestBidIncreased", "highest bid increased event check failed");
	     	assert.equal(receipt.logs[0].args.bidder, accounts[1], "bidder address check failed");
	     	assert.equal(receipt.logs[0].args.bidAmount, web3.toWei(20, "ether"), "bid amount check failed");
	     	return auctionInstance.highestBidder();
	    }).then(function(highestBidder) {
	    	assert.equal(highestBidder, accounts[1], "highest bidder updated to Bob check failed");
	    	return auctionInstance.highestBid();
	    }).then(function(highestBid) {
	    	assert.equal(highestBid, web3.toWei(20, "ether"), "highest bid updated to 20 ether check failed");
	    });
	});

	it("Charlie comes in with a bid of 20.1 ether", function() {
	  	return Auction.deployed().then(function(instance) {
	  		auctionInstance = instance;
	      	return auctionInstance.placeBid({ from: accounts[2], value: web3.toWei(20.1, "ether")});
	    }).then(function(receipt) {
	      	assert.equal(receipt.logs.length, 1, "emit event check failed");
	      	assert.equal(receipt.logs[0].event, "HighestBidIncreased", "highest bid increased event check failed");
	     	assert.equal(receipt.logs[0].args.bidder, accounts[2], "bidder address check failed");
	     	assert.equal(receipt.logs[0].args.bidAmount, web3.toWei(20.1, "ether"), "bid amount check failed");
	     	return auctionInstance.highestBidder();
	    }).then(function(highestBidder) {
	    	assert.equal(highestBidder, accounts[2], "highest bidder updated to Bob check failed");
	    	return auctionInstance.highestBid();
	    }).then(function(highestBid) {
	    	assert.equal(highestBid, web3.toWei(20.1, "ether"), "highest bid updated to 12.1 ether check failed");
	    });
	});

	it("David places a bid of 30 ether and becomes the new highest bidder again", function() {
	  	return Auction.deployed().then(function(instance) {
	  		auctionInstance = instance;
	      	return auctionInstance.placeBid({ from: accounts[3], value: web3.toWei(30, "ether")});
	    }).then(function(receipt) {
	      	assert.equal(receipt.logs.length, 1, "emit event check failed");
	      	assert.equal(receipt.logs[0].event, "HighestBidIncreased", "highest bid increased event check failed");
	     	assert.equal(receipt.logs[0].args.bidder, accounts[3], "bidder address check failed");
	     	assert.equal(receipt.logs[0].args.bidAmount, web3.toWei(30, "ether"), "bid amount check failed");
	     	return auctionInstance.highestBidder();
	    }).then(function(highestBidder) {
	    	assert.equal(highestBidder, accounts[3], "highest bidder updated to David check failed");
	    	return auctionInstance.highestBid();
	    }).then(function(highestBid) {
	    	assert.equal(highestBid, web3.toWei(30, "ether"), "highest bid updated to 30 ether check failed");
	    });
	});

	it("Bob wins the auction by buying the Lambo for 50 ether", function() {
	  	return Auction.deployed().then(function(instance) {
	  		auctionInstance = instance;
	      	return auctionInstance.placeBid({ from: accounts[1], value: web3.toWei(50, "ether")});
	    }).then(function(receipt) {
	      	assert.equal(receipt.logs.length, 2, "emit multiple events check failed");
	      	assert.equal(receipt.logs[0].event, "AuctionEnded", "auction ended event check failed");
	      	assert.equal(receipt.logs[0].args.winner, accounts[1], "auction winner check failed");
	      	assert.equal(receipt.logs[0].args.winningAmount, web3.toWei(50, "ether"), "winning amount check failed");
	      	assert.equal(receipt.logs[1].event, "HighestBidIncreased", "highest bid increased event check failed");
	     	assert.equal(receipt.logs[1].args.bidder, accounts[1], "bidder address check failed");
	     	assert.equal(receipt.logs[1].args.bidAmount, web3.toWei(50, "ether"), "bid amount check failed");
	     	return auctionInstance.highestBidder();
	    }).then(function(highestBidder) {
	    	assert.equal(highestBidder, accounts[1], "highest bidder updated to Bob check failed");
	    	return auctionInstance.highestBid();
	    }).then(function(highestBid) {
	    	assert.equal(highestBid, web3.toWei(50, "ether"), "highest bid updated to 50 ether check failed");
	    });
	});

	it("Auction has ended with a total of 6 bids", function() {
		return Auction.deployed().then(function(instance) {
			auctionInstance = instance;
			return auctionInstance.ended();	
		}).then(function(ended) {
			assert.equal(ended, true, "ended check failed");
			return auctionInstance.bidCount();
		}).then(function(bidCount) {
			assert.equal(bidCount, 6, "bid count check failed");
		});
	});

	it("Alice can no longer cancel or end the auction as it has already ended", function() {
		return Auction.deployed().then(function(instance) {
			auctionInstance = instance;
			return auctionInstance.cancelAuction();
		}).then(assert.fail).catch(function(error) {
	    	assert(error.message.indexOf('revert') >= 0, "cancel auction check failed");
	    	return auctionInstance.endAuction();
	    }).then(assert.fail).catch(function(error) {
	    	assert(error.message.indexOf('revert') >= 0, "end auction check failed");
	    });
	});

	it("Charlie and David can no longer bid for the item", function() {
		return Auction.deployed().then(function(instance) {
	  		auctionInstance = instance;
	  		return auctionInstance.placeBid({ from: accounts[2], value: web3.toWei(55, "ether")});
	  	}).then(assert.fail).catch(function(error) {
	  		assert(error.message.indexOf('revert') >= 0, "Charlie bid check failed");
	  		return auctionInstance.placeBid({ from: accounts[3], value: web3.toWei(55, "ether")});
	  	}).then(assert.fail).catch(function(error) {
	  		assert(error.message.indexOf('revert') >= 0, "David bid check failed");
	  	});
	});

	it("Alice withdraws the winning bid amount of 50 ether", function() {
		return Auction.deployed().then(function(instance) {
			return auctionInstance.withdraw({from: accounts[0]});		
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[0], "withdraw account for Alice check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, web3.toWei(50, "ether"), "withdraw amount for Alice check failed");
		});
	});

	it("Bob, Charlie and David withdraw their portion of the remaining ether", function() {
		return Auction.deployed().then(function(instance) {
			auctionInstance = instance;
			return auctionInstance.withdraw({from: accounts[1]});
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[1], "withdraw account for Bob check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, web3.toWei(20, "ether"), "withdraw amount for Bob check failed");
			return auctionInstance.withdraw({from: accounts[2]});
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[2], "withdraw account for Charlie check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, web3.toWei(20.1, "ether"), "withdraw amount for Charlie check failed");
			return auctionInstance.withdraw({from: accounts[3]});
		}).then(function(withdraw) {
			assert.equal(withdraw.logs[0].args.withdrawAccount, accounts[3], "withdraw account for David check failed");
			assert.equal(withdraw.logs[0].args.withdrawAmount, web3.toWei(40, "ether"), "withdraw amount for David check failed");
		});
	});
});