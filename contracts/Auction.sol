pragma solidity ^0.4.24;

import "./SafeMath.sol";

contract Auction {
    
    // OpenZeppelin SafeMath 
    using SafeMath for uint256;
    
    // Variables
    address public owner; // The owner is the seller of the item
    string public itemName;
    enum Conditions {BrandNew, LikeNew, VeryGood, Good, Acceptable}
    Conditions public condition;
    uint public auctionEndTime; // Auction end time is calculated using the unix timestamp
    uint public startPrice; // Minimum bid price
    uint public buyPrice; // "Buy it now" price
    uint public bidCount;
    address public highestBidder;
    uint public highestBid;
    bool public ended; // Tracks whether the auction has ended
    mapping(address => uint) public pendingWithdrawals;
    
    // Events
    event AuctionStarted(string bidItem);
    event AuctionEnded(address winner, uint winningAmount);
    event HighestBidIncreased(address bidder, uint bidAmount);  
    event AuctionCancelled();
    event Withdrawal(string message, address withdrawAccount, uint withdrawAmount);
    
    // Checks if it's the owner of the contract
    modifier ownerOnly() {
        require(msg.sender == owner);
        _;
    }
    
    // Checks that the auction is active
    modifier isActive() {
        require(!ended, "Auction has already ended.");
        require(now < auctionEndTime, "Auction end time has already been reached.");
        _;
    }
    
    // Initialises the contract along with its variables
    constructor(string _itemName, Conditions _condition, uint _durationMinutes, uint _startPrice, uint _buyPrice) public { 
        require(_durationMinutes > 0, "Duration must be above 0.");
        require(_startPrice >= 0 && _buyPrice > 0, "Start and buy price must be above 0."); 
        require(_startPrice < _buyPrice, "Buy price must be higher than the start price.");

        owner = msg.sender;
        itemName = _itemName;
        condition = _condition;
        auctionEndTime = now + (_durationMinutes * 1 minutes);
        startPrice = _startPrice;
        buyPrice = _buyPrice;
        
        emit AuctionStarted(itemName);
    }
    
    // Placing a bid
    function placeBid() public payable isActive {  
        require(msg.sender != owner, "Bidding on your own items is NOT allowed.");
        require(msg.value >= startPrice && msg.value > highestBid, "Bid price is too low.");
        
        bidCount++;
        
        // If a bid already exists then add it to the pending withdrawals
        if(highestBid != 0) {
            pendingWithdrawals[highestBidder] = pendingWithdrawals[highestBidder].add(highestBid);
        }
        
        // Update the new highest bidder and bid price
        highestBidder = msg.sender;
        highestBid = msg.value;
        
        // Triggers the "buy it now" condition
        if(msg.value >= buyPrice) {
            highestBid = buyPrice;

            // Refund the difference if the bid placed is higher than the buy price
            pendingWithdrawals[highestBidder] = pendingWithdrawals[highestBidder].add(msg.value - buyPrice);
            itemBought();
        }
        emit HighestBidIncreased(highestBidder, highestBid);
    }
    
    // End the auction
    function endAuction() public ownerOnly {
        require(!ended, "Auction has ended.");
        require(now >= auctionEndTime, "Auction end time has not been reached.");
        ended = true;
        pendingWithdrawals[owner] = highestBid;
        emit AuctionEnded(highestBidder, highestBid);
    }
    
    // Item bought
    function itemBought() private {
        ended = true;
        pendingWithdrawals[owner] = highestBid;
        emit AuctionEnded(highestBidder, highestBid);    
    }
    
    // Cancel the auction
    function cancelAuction() public ownerOnly isActive {
        pendingWithdrawals[highestBidder] = pendingWithdrawals[highestBidder].add(highestBid);
        ended = true;
        emit AuctionCancelled();
    }
    
    // Lets the user withdraw funds by themselves
    function withdraw() public returns (bool) {
        
        uint amount = pendingWithdrawals[msg.sender];
        
        // Checks if sender has any pending withdrawals
        if(amount > 0) {
            pendingWithdrawals[msg.sender] = 0;
            if(!msg.sender.send(amount)) {
                // In case the withdraw fails
                pendingWithdrawals[msg.sender] = amount;
                emit Withdrawal("Failed", msg.sender, amount);
                return false;
            }
        }
        emit Withdrawal("Completed", msg.sender, amount);
        return true;
    }
    
    // Get the time remaining for the auction (in seconds)
    function timeRemaining() public view isActive returns (uint) {
        return auctionEndTime - now;
    }
}