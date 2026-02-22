import React from 'react';
import Avatar from 'react-avatar';

const Client = ({ username }) => {
    return (
        <div className="client">
            <Avatar name={username} size={32} round="8px" />
            <span className="userName">{username}</span>
            <span className="onlineDot"></span>
        </div>
    );
};

export default Client;
