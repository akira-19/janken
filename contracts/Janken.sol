pragma solidity ^0.5.0;

contract Janken {


    struct gameRoom {
        bytes32 gameId;
        address payable player1;
        address payable player2;
        bytes32 cryptedPlayer1hand;
        uint8 player2hand;
            // 1: グー
            // 2: チョキ
            // 3: パー
        uint player1bet;
        uint player2bet;
        bool gameCompleted;
        uint payBackTime;
    }

    gameRoom[] gameRooms;
    mapping (bytes32 => gameRoom) gameRoomMap;

    event gameCreated(
            bytes32 gameId,
            address indexed player1
        );
    event player2joined(
            bytes32 gameId,
            address indexed player1,
            address indexed player2
        );
    event player1submitHand(
            bytes32 gameId,
            address indexed player1,
            address indexed player2
        );
    event player2submitHand(
            bytes32 gameId,
            address indexed player1,
            address indexed player2
        );
    event gameCompleted(
            bytes32 gameId,
            address indexed player1,
            address indexed player2,
            string result
        );
    event gameClosed(
        bytes32 gameId,
        address indexed player1,
        address indexed player2
        );


    function createGame() public payable {
        gameRoom memory gr;
        gr.gameId = keccak256(abi.encodePacked(block.number, msg.sender));
        gr.player1 = msg.sender;
        gr.player1bet = msg.value;
        gr.gameCompleted = false;
        gr.payBackTime = now + 600;
        gameRooms.push(gr);
        gameRoomMap[gr.gameId] = gr;
        emit gameCreated(gr.gameId, msg.sender);
    }

    function joinGame(bytes32 _gameId) public payable{
        gameRoom storage gr = gameRoomMap[_gameId];
        require(gr.gameCompleted == false);
        require(gr.player1bet == msg.value, "bet the same amount as the opponent bet");
        gr.player2 = msg.sender;
        gr.payBackTime = now + 600;
        gr.player2bet = msg.value;

        emit player2joined(_gameId, gr.player1, gr.player2);
    }

    function getBackBetForPlayer1(bytes32 _gameId) public payable{
        require(gameRoomMap[_gameId].payBackTime < now, "too early to withdraw");
        require(gameRoomMap[_gameId].player1 == msg.sender, "msg.sender must be Host player");
        require(gameRoomMap[_gameId].gameCompleted == false, "The game must be not completed");
        require(gameRoomMap[_gameId].gameCompleted == false);

        if (gameRoomMap[_gameId].player2 == address(0x0)){
            // when no one joined the game, the host player get back money
            uint backAmount = gameRoomMap[_gameId].player1bet;
            gameRoomMap[_gameId].player1bet = 0;
            msg.sender.transfer(backAmount);
        }else if(gameRoomMap[_gameId].cryptedPlayer1hand != 0 && gameRoomMap[_gameId].player2hand == 0){
            // when the guest player didn't submit their hand, the host player get the all bet
            uint backAmount = gameRoomMap[_gameId].player1bet + gameRoomMap[_gameId].player2bet;
            gameRoomMap[_gameId].player1bet = 0;
            gameRoomMap[_gameId].player2bet = 0;
            msg.sender.transfer(backAmount);
        }

        gameRoomMap[_gameId].gameCompleted = true;
        emit gameClosed(_gameId, gameRoomMap[_gameId].player1, gameRoomMap[_gameId].player2);

    }

    function getBackBetForPlayer2(bytes32 _gameId) public payable{
        require(gameRoomMap[_gameId].payBackTime < now, "too early to withdraw");
        require(gameRoomMap[_gameId].player2 == msg.sender, "msg.sender must be Guest player");
        require(gameRoomMap[_gameId].gameCompleted == false, "The game must be not completed");
        require(gameRoomMap[_gameId].gameCompleted == false);

        if((gameRoomMap[_gameId].player2 == msg.sender && gameRoomMap[_gameId].cryptedPlayer1hand == 0) || gameRoomMap[_gameId].player2hand != 0){
            // when the host player didn't submit their hand or when the host player didn't judge, the guest player will get all the bet
            uint backAmount = gameRoomMap[_gameId].player1bet + gameRoomMap[_gameId].player2bet;
            gameRoomMap[_gameId].player1bet = 0;
            gameRoomMap[_gameId].player2bet = 0;
            msg.sender.transfer(backAmount);
        }

        gameRoomMap[_gameId].gameCompleted == true;
        emit gameClosed(_gameId, gameRoomMap[_gameId].player1, gameRoomMap[_gameId].player2);
    }


    function setHandPlayer1(bytes32 _gameId, uint8 _hand, string memory _passphrase) public {
        require(gameRoomMap[_gameId].player1 == msg.sender, "You must be host player");
        require(gameRoomMap[_gameId].gameCompleted == false, "The game must be not completed");
        require(gameRoomMap[_gameId].cryptedPlayer1hand == 0);
        require(_hand == 1 || _hand == 2 || _hand == 3, "hand must be 1, 2 or 3");
        gameRoomMap[_gameId].cryptedPlayer1hand
            = keccak256(abi.encodePacked(_hand, _passphrase));
        gameRoomMap[_gameId].payBackTime = now + 600;
        emit player1submitHand(_gameId, gameRoomMap[_gameId].player1, gameRoomMap[_gameId].player2);
    }

    function setHandPlayer2(bytes32 _gameId, uint8 _hand) public{
        require(gameRoomMap[_gameId].cryptedPlayer1hand != 0, "Host player didnt set their hand yet");
        require(gameRoomMap[_gameId].player2 == msg.sender, "You must be guest player");
        require(gameRoomMap[_gameId].gameCompleted == false, "The game must be not completed");
        require(gameRoomMap[_gameId].player2hand == 0);
        require(_hand == 1 || _hand == 2 || _hand == 3, "hand must be 1, 2 or 3");
        gameRoomMap[_gameId].player2hand = _hand;
        gameRoomMap[_gameId].payBackTime = now + 600;
        emit player2submitHand(_gameId, gameRoomMap[_gameId].player1, gameRoomMap[_gameId].player2);
    }

    function judge(bytes32 _gameId, uint8 _hand, string memory _passphrase) public payable{
        require(gameRoomMap[_gameId].cryptedPlayer1hand == keccak256(abi.encodePacked(_hand, _passphrase)), "Your hand and passphrase have to be the same as the ones you submitted");
        require(gameRoomMap[_gameId].gameCompleted == false, "The game must be not completed");
        int8 player1hand = int8(_hand);
        int8 player2hand = int8(gameRoomMap[_gameId].player2hand);
        if (player1hand - player2hand == -1 || player1hand - player2hand == 2){
            //player1 wins
            uint betAmount = gameRoomMap[_gameId].player1bet + gameRoomMap[_gameId].player2bet;
            gameRoomMap[_gameId].player1bet = 0;
            gameRoomMap[_gameId].player2bet = 0;
            msg.sender.transfer(betAmount);
            emit gameCompleted(_gameId, gameRoomMap[_gameId].player1, gameRoomMap[_gameId].player2, "The host player won!");
        }else if(player1hand - player2hand == 1 || player1hand - player2hand == -2){
            //player2 wins
            uint betAmount = gameRoomMap[_gameId].player1bet + gameRoomMap[_gameId].player2bet;
            gameRoomMap[_gameId].player1bet = 0;
            gameRoomMap[_gameId].player2bet = 0;
            gameRoomMap[_gameId].player2.transfer(betAmount);
            emit gameCompleted(_gameId, gameRoomMap[_gameId].player1, gameRoomMap[_gameId].player2, "The guest player won!");
        }else if(player1hand - player2hand == 0){
            // draw
            uint betAmountForPlayer1 = gameRoomMap[_gameId].player1bet;
            uint betAmountForPlayer2 = gameRoomMap[_gameId].player2bet;
            gameRoomMap[_gameId].player1bet = 0;
            gameRoomMap[_gameId].player2bet = 0;
            msg.sender.transfer(betAmountForPlayer1);
            gameRoomMap[_gameId].player2.transfer(betAmountForPlayer2);
            emit gameCompleted(_gameId, gameRoomMap[_gameId].player1, gameRoomMap[_gameId].player2, "It was a draw");
        }

        gameRoomMap[_gameId].gameCompleted = true;

    }

    function getBet(bytes32 _gameId) public view returns(uint){
        return gameRoomMap[_gameId].player1bet;
    }

    function getPlayer1(bytes32 _gameId) public view returns(address){
        return gameRoomMap[_gameId].player1;
    }

    function getPlayer2(bytes32 _gameId) public view returns(address){
        return gameRoomMap[_gameId].player2;
    }

    function getPlayer1hand(bytes32 _gameId) public view returns(bytes32){
        return gameRoomMap[_gameId].cryptedPlayer1hand;
    }

    function getPlayer2hand(bytes32 _gameId) public view returns(uint8){
        return gameRoomMap[_gameId].player2hand;
    }

    function checkIfGameCompleted(bytes32 _gameId) public view returns(bool){
        return gameRoomMap[_gameId].gameCompleted;
    }

}
